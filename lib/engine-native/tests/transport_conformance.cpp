#include "../generated/SovereignTransport.h"
#include <iostream>
#include <cassert>

using namespace Sovereign;

int passed = 0;
int failed = 0;

void check(bool condition, const std::string& name) {
    if (condition) {
        std::cout << "  PASS: " << name << std::endl;
        passed++;
    } else {
        std::cerr << "  FAIL: " << name << std::endl;
        failed++;
    }
}

void testAuthServiceSingleton() {
    std::cout << "\n=== Task 2: UAuthService ===" << std::endl;

    auto& auth = UAuthService::Get();
    auto& auth2 = UAuthService::Get();
    check(&auth == &auth2, "Auth singleton — same instance");

    check(!auth.isAuthenticated(), "Auth initial state — not authenticated");
    check(auth.isTokenExpired(), "Auth initial state — token expired");
    check(auth.getToken().empty(), "Auth initial state — no token");
    check(auth.getUserId().empty(), "Auth initial state — no user ID");
}

void testAuthTokenManagement() {
    auto& auth = UAuthService::Get();

    int64_t futureExpiry = static_cast<int64_t>(std::time(nullptr)) + 3600;
    auth.setTokenDirect("test-jwt-token-123", "native-user-001", "session-abc", futureExpiry);

    check(auth.isAuthenticated(), "Auth setTokenDirect — now authenticated");
    check(!auth.isTokenExpired(), "Auth setTokenDirect — not expired (1 hour TTL)");
    check(auth.getToken() == "test-jwt-token-123", "Auth getToken — returns correct token");
    check(auth.getUserId() == "native-user-001", "Auth getUserId — returns correct user");

    auto state = auth.getState();
    check(state.sessionId == "session-abc", "Auth state — correct session ID");
    check(state.expiresAt == futureExpiry, "Auth state — correct expiry");
    check(state.authenticated, "Auth state — authenticated flag set");
}

void testAuthExpiry() {
    auto& auth = UAuthService::Get();

    int64_t pastExpiry = static_cast<int64_t>(std::time(nullptr)) - 10;
    auth.setTokenDirect("expired-token", "user", "sess", pastExpiry);

    check(!auth.isAuthenticated(), "Auth expired token — not authenticated");
    check(auth.isTokenExpired(), "Auth expired token — isTokenExpired() true");
}

void testAuthClear() {
    auto& auth = UAuthService::Get();

    int64_t futureExpiry = static_cast<int64_t>(std::time(nullptr)) + 3600;
    auth.setTokenDirect("token", "user", "sess", futureExpiry);
    check(auth.isAuthenticated(), "Auth before clear — authenticated");

    auth.clearAuth();
    check(!auth.isAuthenticated(), "Auth after clear — not authenticated");
    check(auth.getToken().empty(), "Auth after clear — token empty");
    check(auth.getUserId().empty(), "Auth after clear — user empty");
}

void testHttpClientSingleton() {
    std::cout << "\n=== Task 1: USovereignHttpClient ===" << std::endl;

    auto& client = USovereignHttpClient::Get();
    auto& client2 = USovereignHttpClient::Get();
    check(&client == &client2, "HttpClient singleton — same instance");
}

void testBaseUrl() {
    auto& client = USovereignHttpClient::Get();
    client.setBaseUrl("http://localhost:8000");
    check(client.getBaseUrl() == "http://localhost:8000", "HttpClient baseUrl — set correctly");

    client.setBaseUrl("http://localhost:8000/");
    check(client.getBaseUrl() == "http://localhost:8000", "HttpClient baseUrl — trailing slash stripped");
}

void testPrepareGetRequest() {
    auto& client = USovereignHttpClient::Get();
    client.setBaseUrl("http://localhost:8000");
    UAuthService::Get().clearAuth();

    auto req = client.prepareRequest(HttpMethod::GET, "/api/health");
    check(req.fullUrl == "http://localhost:8000/api/health", "GET request — correct URL");
    check(req.headers.count("Content-Type") > 0, "GET request — has Content-Type");
    check(req.headers.count("X-Client-Engine") > 0, "GET request — has X-Client-Engine");
    check(req.headers.count("Authorization") == 0, "GET request — no auth header (not authenticated)");
    check(!req.hasPayloadHash, "GET request — no payload hash");
    check(req.body.empty(), "GET request — empty body");
}

void testPreparePostWithPayload() {
    auto& client = USovereignHttpClient::Get();
    client.setBaseUrl("http://localhost:8000");

    JsonValue payload = JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("native-user-001")},
        {"vehicle_id", JsonValue(1)},
    });

    auto req = client.prepareRequest(HttpMethod::POST, "/api/bids", payload);
    check(req.fullUrl == "http://localhost:8000/api/bids", "POST request — correct URL");
    check(req.hasPayloadHash, "POST request — has payload hash");
    check(!req.payloadHash.empty(), "POST request — hash is non-empty");
    check(req.payloadHash.size() == 64, "POST request — hash is 64 hex chars (SHA-256)");

    std::string expectedBody = payload.canonicalize();
    check(req.body == expectedBody, "POST request — body is canonical JSON");

    std::string expectedHash = SovereignSHA256::hash(expectedBody);
    check(req.payloadHash == expectedHash, "POST request — hash matches body SHA-256");
    check(req.headers["X-Payload-Hash"] == expectedHash, "POST request — X-Payload-Hash header set");
}

void testAuthHeaderInjection() {
    auto& client = USovereignHttpClient::Get();
    auto& auth = UAuthService::Get();

    int64_t futureExpiry = static_cast<int64_t>(std::time(nullptr)) + 3600;
    auth.setTokenDirect("jwt-for-native-client", "native-user-001", "sess-1", futureExpiry);

    auto req = client.prepareRequest(HttpMethod::POST, "/api/ping",
        JsonValue::object({{"test", JsonValue(true)}}));

    check(req.headers.count("Authorization") > 0, "Auth injection — Authorization header present");
    check(req.headers["Authorization"] == "Bearer jwt-for-native-client",
          "Auth injection — correct Bearer token format");

    auth.clearAuth();
}

void testPutAndPatchGetHash() {
    auto& client = USovereignHttpClient::Get();

    JsonValue payload = JsonValue::object({{"status", JsonValue("updated")}});

    auto putReq = client.prepareRequest(HttpMethod::PUT, "/api/resource", payload);
    check(putReq.hasPayloadHash, "PUT request — has payload hash");
    check(!putReq.payloadHash.empty(), "PUT request — hash computed");

    auto patchReq = client.prepareRequest(HttpMethod::PATCH, "/api/resource", payload);
    check(patchReq.hasPayloadHash, "PATCH request — has payload hash");

    check(putReq.payloadHash == patchReq.payloadHash, "PUT/PATCH — same payload, same hash");
}

void testGetDeleteNoHash() {
    auto& client = USovereignHttpClient::Get();

    auto getReq = client.prepareRequest(HttpMethod::GET, "/api/test");
    check(!getReq.hasPayloadHash, "GET request — no hash (read-only)");

    auto delReq = client.prepareRequest(HttpMethod::DELETE_METHOD, "/api/test/1");
    check(!delReq.hasPayloadHash, "DELETE request — no hash (no body)");
}

void testDelegateRouting() {
    std::cout << "\n=== Status Code Routing ===" << std::endl;

    auto& client = USovereignHttpClient::Get();
    bool integrityFired = false;
    bool identityFired = false;
    bool conflictFired = false;

    client.onIntegrityFault([&](const HttpResponse& resp, const std::string& expected, const std::string& server) {
        integrityFired = true;
    });
    client.onIdentityExpired([&](const HttpResponse& resp) {
        identityFired = true;
    });
    client.onStateConflict([&](const HttpResponse& resp, const std::string& key) {
        conflictFired = true;
    });

    USovereignHttpClient::PreparedRequest dummyReq;
    dummyReq.method = HttpMethod::POST;
    dummyReq.fullUrl = "http://localhost:8000/api/test";
    dummyReq.payloadHash = "abc123";
    dummyReq.hasPayloadHash = true;

    HttpResponse resp400{400, "{\"code\":\"INTEGRITY_HASH_MISMATCH\"}", {}, false, ""};
    client.routeResponse(resp400, dummyReq);
    check(integrityFired, "Delegate 400 — OnIntegrityFault fired");
    check(!identityFired, "Delegate 400 — OnIdentityExpired NOT fired");
    check(!conflictFired, "Delegate 400 — OnStateConflict NOT fired");

    integrityFired = false;
    HttpResponse resp403{403, "{\"code\":\"TOKEN_EXPIRED\"}", {}, false, ""};
    client.routeResponse(resp403, dummyReq);
    check(!integrityFired, "Delegate 403 — OnIntegrityFault NOT fired");
    check(identityFired, "Delegate 403 — OnIdentityExpired fired");

    identityFired = false;
    HttpResponse resp409{409, "{\"code\":\"STATE_VERSION_CONFLICT\"}", {}, false, ""};
    client.routeResponse(resp409, dummyReq);
    check(conflictFired, "Delegate 409 — OnStateConflict fired");
    check(!integrityFired, "Delegate 409 — OnIntegrityFault NOT fired");
    check(!identityFired, "Delegate 409 — OnIdentityExpired NOT fired");

    HttpResponse resp200{200, "{\"ok\":true}", {}, true, ""};
    integrityFired = false;
    identityFired = false;
    conflictFired = false;
    client.routeResponse(resp200, dummyReq);
    check(!integrityFired && !identityFired && !conflictFired, "Delegate 200 — no delegates fired");
}

void testDiagnosticsTracking() {
    std::cout << "\n=== Diagnostics ===" << std::endl;

    auto& client = USovereignHttpClient::Get();
    client.clearDiagnostics();

    USovereignHttpClient::PreparedRequest req;
    req.method = HttpMethod::POST;
    req.fullUrl = "http://localhost:8000/api/ping";
    req.payloadHash = "hash123";
    req.hasPayloadHash = true;

    HttpResponse resp200{200, "{}", {}, true, ""};
    client.routeResponse(resp200, req);

    auto diags = client.getDiagnostics();
    check(diags.size() >= 1, "Diagnostics — entry recorded");
    check(diags.back().statusCode == 200, "Diagnostics — correct status code");
    check(diags.back().method == "POST", "Diagnostics — correct method");
    check(diags.back().integrityVerified, "Diagnostics — integrity verified on 200 with hash");
}

void testPingRequestSerialization() {
    std::cout << "\n=== Ping Request ===" << std::endl;

    PingRequest ping;
    ping.clientVersion = "1.0.0";
    ping.userId = "native-user-001";
    ping.clientTimestamp = 1700000000;

    JsonValue json = ping.toSovereignJson();
    std::string canonical = json.canonicalize();

    check(canonical.find("\"client_version\":\"1.0.0\"") != std::string::npos,
          "PingRequest — client_version serialized");
    check(canonical.find("\"user_id\":\"native-user-001\"") != std::string::npos,
          "PingRequest — user_id serialized");
    check(canonical.find("\"client_timestamp\":1700000000") != std::string::npos,
          "PingRequest — client_timestamp serialized");

    std::string hash = SovereignSHA256::hash(canonical);
    check(hash.size() == 64, "PingRequest — SHA-256 hash is 64 chars");
}

void testPingPythonParity() {
    PingRequest ping;
    ping.clientVersion = "1.0.0";
    ping.userId = "native-user-001";
    ping.clientTimestamp = 1700000000;

    JsonValue json = ping.toSovereignJson();
    std::string canonical = json.canonicalize();

    check(canonical == "{\"client_timestamp\":1700000000,\"client_version\":\"1.0.0\",\"user_id\":\"native-user-001\"}",
          "PingRequest — canonical JSON matches Python sort order");

    std::string hash = SovereignSHA256::hash(canonical);
    check(hash.size() == 64, "PingRequest — hash is valid SHA-256");
}

void testTamperDetection() {
    std::cout << "\n=== Binary Integrity Test (Tamper Detection) ===" << std::endl;

    auto& client = USovereignHttpClient::Get();
    client.setBaseUrl("http://localhost:8000");

    PingRequest ping;
    ping.clientVersion = "1.0.0";
    ping.userId = "native-user-001";
    ping.clientTimestamp = 1700000000;

    auto validReq = preparePingRequest(ping);
    std::string originalBody = validReq.body;
    std::string originalHash = validReq.payloadHash;

    check(!originalBody.empty(), "Tamper test — original body non-empty");
    check(!originalHash.empty(), "Tamper test — original hash non-empty");
    check(originalHash == SovereignSHA256::hash(originalBody),
          "Tamper test — hash matches body (pre-tamper)");

    std::string tamperedBody = originalBody + " ";
    std::string tamperedHash = SovereignSHA256::hash(tamperedBody);
    check(tamperedHash != originalHash, "Tamper test — appending space changes hash");

    std::string tamperedBody2 = originalBody;
    tamperedBody2[tamperedBody2.size() - 2] = 'X';
    std::string tamperedHash2 = SovereignSHA256::hash(tamperedBody2);
    check(tamperedHash2 != originalHash, "Tamper test — single char change detected");

    std::string tamperedBody3 = originalBody + ",";
    std::string tamperedHash3 = SovereignSHA256::hash(tamperedBody3);
    check(tamperedHash3 != originalHash, "Tamper test — appending comma detected");

    check(SovereignSHA256::hash(originalBody) == originalHash,
          "Tamper test — original body hash unchanged (deterministic)");
}

void testPingResponseParsing() {
    std::string json = R"({"verified":true,"server_hash":"abc123","client_hash":"abc123","server_timestamp":1700000000,"server_version":"1.0.0"})";
    auto resp = PingResponse::fromJson(json);

    check(resp.verified, "PingResponse parse — verified is true");
    check(resp.serverHash == "abc123", "PingResponse parse — server_hash extracted");
    check(resp.clientHash == "abc123", "PingResponse parse — client_hash extracted");
    check(resp.serverVersion == "1.0.0", "PingResponse parse — server_version extracted");

    auto validReq = USovereignHttpClient::PreparedRequest{};
    validReq.payloadHash = "abc123";
    check(verifyPingIntegrity(validReq, resp), "PingResponse verify — hashes match = true");

    auto mismatchReq = USovereignHttpClient::PreparedRequest{};
    mismatchReq.payloadHash = "different_hash";
    check(!verifyPingIntegrity(mismatchReq, resp), "PingResponse verify — hash mismatch = false");
}

void testInterceptors() {
    std::cout << "\n=== Request Interceptors ===" << std::endl;

    auto& client = USovereignHttpClient::Get();

    bool intercepted = false;
    client.addInterceptor([&](HttpMethod method, const std::string& path,
                              std::map<std::string, std::string>& headers, std::string& body) {
        intercepted = true;
        headers["X-Custom-Header"] = "intercepted";
    });

    auto req = client.prepareRequest(HttpMethod::GET, "/api/test");
    check(intercepted, "Interceptor — callback executed");
    check(req.headers["X-Custom-Header"] == "intercepted", "Interceptor — custom header added");
}

void testZeroTrustHandshake() {
    std::cout << "\n=== Zero-Trust Handshake ===" << std::endl;

    auto& auth = UAuthService::Get();
    auth.clearAuth();

    check(!auth.isAuthenticated(), "Zero-Trust — starts unauthenticated");

    int64_t futureExpiry = static_cast<int64_t>(std::time(nullptr)) + 3600;
    auth.setTokenDirect("hs256-jwt-token", "native-user-001", "session-xyz", futureExpiry);

    check(auth.isAuthenticated(), "Zero-Trust — authenticated after token set");
    check(auth.getToken() == "hs256-jwt-token", "Zero-Trust — token accessible");
    check(auth.getUserId() == "native-user-001", "Zero-Trust — user ID matches");

    auto& client = USovereignHttpClient::Get();
    auto req = client.prepareRequest(HttpMethod::POST, "/api/ping",
        JsonValue::object({{"test", JsonValue(1)}}));
    check(req.headers["Authorization"] == "Bearer hs256-jwt-token",
          "Zero-Trust — JWT injected into request");
    check(req.hasPayloadHash, "Zero-Trust — payload hash computed");

    auth.clearAuth();
    auto reqNoAuth = client.prepareRequest(HttpMethod::POST, "/api/ping",
        JsonValue::object({{"test", JsonValue(1)}}));
    check(reqNoAuth.headers.count("Authorization") == 0,
          "Zero-Trust — no auth header when cleared");
}

int main() {
    std::cout << "=== Module 0: Sovereign Transport & Auth Bridge ===" << std::endl;

    testAuthServiceSingleton();
    testAuthTokenManagement();
    testAuthExpiry();
    testAuthClear();
    testHttpClientSingleton();
    testBaseUrl();
    testPrepareGetRequest();
    testPreparePostWithPayload();
    testAuthHeaderInjection();
    testPutAndPatchGetHash();
    testGetDeleteNoHash();
    testDelegateRouting();
    testDiagnosticsTracking();
    testPingRequestSerialization();
    testPingPythonParity();
    testTamperDetection();
    testPingResponseParsing();
    testInterceptors();
    testZeroTrustHandshake();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "TRANSPORT RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
