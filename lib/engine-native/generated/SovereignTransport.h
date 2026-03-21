#pragma once

#include "SovereignSerializer.h"
#include <string>
#include <map>
#include <functional>
#include <mutex>
#include <vector>
#include <ctime>

namespace Sovereign {

enum class HttpMethod { GET, POST, PUT, PATCH, DELETE_METHOD };

struct HttpResponse {
    int statusCode;
    std::string body;
    std::map<std::string, std::string> headers;
    bool success;
    std::string error;
};

struct TransportDiagnostic {
    std::string timestamp;
    std::string method;
    std::string path;
    int statusCode;
    std::string payloadHash;
    std::string error;
    bool integrityVerified;
};

using IntegrityFaultDelegate = std::function<void(const HttpResponse&, const std::string& expectedHash, const std::string& serverHash)>;
using IdentityExpiredDelegate = std::function<void(const HttpResponse&)>;
using StateConflictDelegate = std::function<void(const HttpResponse&, const std::string& entityKey)>;
using RequestInterceptor = std::function<void(HttpMethod method, const std::string& path, std::map<std::string, std::string>& headers, std::string& body)>;

class UAuthService {
public:
    struct AuthState {
        std::string token;
        std::string userId;
        std::string sessionId;
        int64_t expiresAt;
        bool authenticated;
    };

    static UAuthService& Get() {
        static UAuthService instance;
        return instance;
    }

    bool authenticate(const std::string& serverBaseUrl, const std::string& userId) {
        std::lock_guard<std::mutex> lock(authMutex_);
        serverBaseUrl_ = serverBaseUrl;
        pendingUserId_ = userId;
        return true;
    }

    void setTokenDirect(const std::string& token, const std::string& userId,
                        const std::string& sessionId, int64_t expiresAt) {
        std::lock_guard<std::mutex> lock(authMutex_);
        state_.token = token;
        state_.userId = userId;
        state_.sessionId = sessionId;
        state_.expiresAt = expiresAt;
        state_.authenticated = true;
    }

    void clearAuth() {
        std::lock_guard<std::mutex> lock(authMutex_);
        state_ = AuthState{};
    }

    bool isAuthenticated() const {
        std::lock_guard<std::mutex> lock(authMutex_);
        if (!state_.authenticated) return false;
        return state_.expiresAt > static_cast<int64_t>(std::time(nullptr));
    }

    bool isTokenExpired() const {
        std::lock_guard<std::mutex> lock(authMutex_);
        if (!state_.authenticated) return true;
        return state_.expiresAt <= static_cast<int64_t>(std::time(nullptr));
    }

    std::string getToken() const {
        std::lock_guard<std::mutex> lock(authMutex_);
        return state_.token;
    }

    std::string getUserId() const {
        std::lock_guard<std::mutex> lock(authMutex_);
        return state_.userId;
    }

    AuthState getState() const {
        std::lock_guard<std::mutex> lock(authMutex_);
        return state_;
    }

    std::string getServerBaseUrl() const {
        std::lock_guard<std::mutex> lock(authMutex_);
        return serverBaseUrl_;
    }

private:
    UAuthService() = default;
    UAuthService(const UAuthService&) = delete;
    UAuthService& operator=(const UAuthService&) = delete;

    mutable std::mutex authMutex_;
    AuthState state_{};
    std::string serverBaseUrl_;
    std::string pendingUserId_;
};

class USovereignHttpClient {
public:
    static USovereignHttpClient& Get() {
        static USovereignHttpClient instance;
        return instance;
    }

    void setBaseUrl(const std::string& url) {
        std::lock_guard<std::mutex> lock(mutex_);
        baseUrl_ = url;
        if (!baseUrl_.empty() && baseUrl_.back() == '/') {
            baseUrl_.pop_back();
        }
    }

    std::string getBaseUrl() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return baseUrl_;
    }

    void onIntegrityFault(IntegrityFaultDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        integrityFaultDelegate_ = std::move(callback);
    }

    void onIdentityExpired(IdentityExpiredDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        identityExpiredDelegate_ = std::move(callback);
    }

    void onStateConflict(StateConflictDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        stateConflictDelegate_ = std::move(callback);
    }

    void addInterceptor(RequestInterceptor interceptor) {
        std::lock_guard<std::mutex> lock(mutex_);
        interceptors_.push_back(std::move(interceptor));
    }

    struct PreparedRequest {
        HttpMethod method;
        std::string fullUrl;
        std::map<std::string, std::string> headers;
        std::string body;
        std::string payloadHash;
        bool hasPayloadHash;
    };

    PreparedRequest prepareRequest(HttpMethod method, const std::string& path,
                                   const JsonValue& payload = JsonValue::null()) {
        PreparedRequest req;
        req.method = method;
        req.fullUrl = baseUrl_ + path;
        req.hasPayloadHash = false;

        req.headers["Content-Type"] = "application/json";
        req.headers["Accept"] = "application/json";
        req.headers["X-Client-Engine"] = "SovereignNative/1.0";

        auto& auth = UAuthService::Get();
        if (auth.isAuthenticated()) {
            req.headers["Authorization"] = "Bearer " + auth.getToken();
        }

        bool isMutating = (method == HttpMethod::POST ||
                          method == HttpMethod::PUT ||
                          method == HttpMethod::PATCH);

        if (isMutating && payload.getType() != JsonValue::Null) {
            req.body = payload.canonicalize();
            req.payloadHash = SovereignSHA256::hash(req.body);
            req.headers["X-Payload-Hash"] = req.payloadHash;
            req.hasPayloadHash = true;
        }

        for (auto& interceptor : interceptors_) {
            interceptor(method, path, req.headers, req.body);
        }

        return req;
    }

    void routeResponse(const HttpResponse& response, const PreparedRequest& originalRequest) {
        std::lock_guard<std::mutex> lock(mutex_);

        TransportDiagnostic diag;
        diag.timestamp = std::to_string(std::time(nullptr));
        diag.method = methodToString(originalRequest.method);
        diag.path = originalRequest.fullUrl;
        diag.statusCode = response.statusCode;
        diag.payloadHash = originalRequest.payloadHash;
        diag.error = response.error;
        diag.integrityVerified = (response.statusCode == 200 && originalRequest.hasPayloadHash);
        diagnostics_.push_back(diag);

        if (diagnostics_.size() > MAX_DIAGNOSTICS) {
            diagnostics_.erase(diagnostics_.begin());
        }

        switch (response.statusCode) {
            case 400:
                if (integrityFaultDelegate_) {
                    std::string serverHash;
                    auto it = response.headers.find("computed");
                    if (it != response.headers.end()) serverHash = it->second;
                    integrityFaultDelegate_(response, originalRequest.payloadHash, serverHash);
                }
                break;
            case 403:
                if (identityExpiredDelegate_) {
                    identityExpiredDelegate_(response);
                }
                break;
            case 409:
                if (stateConflictDelegate_) {
                    std::string entityKey;
                    stateConflictDelegate_(response, entityKey);
                }
                break;
            default:
                break;
        }
    }

    const std::vector<TransportDiagnostic>& getDiagnostics() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return diagnostics_;
    }

    void clearDiagnostics() {
        std::lock_guard<std::mutex> lock(mutex_);
        diagnostics_.clear();
    }

    static std::string methodToString(HttpMethod m) {
        switch (m) {
            case HttpMethod::GET: return "GET";
            case HttpMethod::POST: return "POST";
            case HttpMethod::PUT: return "PUT";
            case HttpMethod::PATCH: return "PATCH";
            case HttpMethod::DELETE_METHOD: return "DELETE";
        }
        return "UNKNOWN";
    }

private:
    USovereignHttpClient() = default;
    USovereignHttpClient(const USovereignHttpClient&) = delete;
    USovereignHttpClient& operator=(const USovereignHttpClient&) = delete;

    mutable std::mutex mutex_;
    std::string baseUrl_;
    IntegrityFaultDelegate integrityFaultDelegate_;
    IdentityExpiredDelegate identityExpiredDelegate_;
    StateConflictDelegate stateConflictDelegate_;
    std::vector<RequestInterceptor> interceptors_;
    std::vector<TransportDiagnostic> diagnostics_;
    static constexpr size_t MAX_DIAGNOSTICS = 500;
};

struct PingRequest {
    std::string clientVersion;
    std::string userId;
    int64_t clientTimestamp;

    JsonValue toSovereignJson() const {
        return JsonValue::object({
            {"client_timestamp", JsonValue(clientTimestamp)},
            {"client_version", JsonValue(clientVersion)},
            {"user_id", JsonValue(userId)},
        });
    }
};

struct PingResponse {
    bool verified;
    std::string serverHash;
    std::string clientHash;
    int64_t serverTimestamp;
    std::string serverVersion;

    static PingResponse fromJson(const std::string& json) {
        PingResponse resp{};
        auto findStr = [&](const std::string& key) -> std::string {
            std::string search = "\"" + key + "\":\"";
            size_t pos = json.find(search);
            if (pos == std::string::npos) {
                search = "\"" + key + "\": \"";
                pos = json.find(search);
                if (pos == std::string::npos) return "";
            }
            size_t start = pos + search.size();
            size_t end = json.find("\"", start);
            if (end == std::string::npos) return "";
            return json.substr(start, end - start);
        };
        auto findBool = [&](const std::string& key) -> bool {
            std::string search = "\"" + key + "\":";
            size_t pos = json.find(search);
            if (pos == std::string::npos) {
                search = "\"" + key + "\": ";
                pos = json.find(search);
            }
            if (pos == std::string::npos) return false;
            size_t start = pos + search.size();
            while (start < json.size() && json[start] == ' ') start++;
            return json.substr(start, 4) == "true";
        };

        resp.verified = findBool("verified");
        resp.serverHash = findStr("server_hash");
        resp.clientHash = findStr("client_hash");
        resp.serverVersion = findStr("server_version");
        return resp;
    }
};

inline USovereignHttpClient::PreparedRequest preparePingRequest(const PingRequest& ping) {
    auto& client = USovereignHttpClient::Get();
    return client.prepareRequest(HttpMethod::POST, "/api/ping", ping.toSovereignJson());
}

inline bool verifyPingIntegrity(const USovereignHttpClient::PreparedRequest& req,
                                 const PingResponse& resp) {
    return resp.verified && resp.clientHash == req.payloadHash;
}

}
