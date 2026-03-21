#pragma once

#include <string>
#include <vector>
#include <map>
#include <variant>
#include <optional>
#include <cstdint>
#include <cstring>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cmath>
#include <functional>
#include <queue>
#include <fstream>
#include <ctime>

namespace Sovereign {

struct SovereignSHA256 {
    static std::string hash(const std::string& input) {
        uint32_t h[8] = {
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        };

        static const uint32_t K[64] = {
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        };

        auto rotr = [](uint32_t x, int n) -> uint32_t { return (x >> n) | (x << (32 - n)); };

        const uint8_t* data = reinterpret_cast<const uint8_t*>(input.data());
        uint64_t bitlen = static_cast<uint64_t>(input.size()) * 8;
        size_t len = input.size();

        std::vector<uint8_t> msg(data, data + len);
        msg.push_back(0x80);
        while ((msg.size() % 64) != 56) msg.push_back(0x00);
        for (int i = 7; i >= 0; --i) msg.push_back(static_cast<uint8_t>(bitlen >> (i * 8)));

        for (size_t offset = 0; offset < msg.size(); offset += 64) {
            uint32_t w[64];
            for (int i = 0; i < 16; i++) {
                w[i] = (static_cast<uint32_t>(msg[offset + i*4]) << 24) |
                       (static_cast<uint32_t>(msg[offset + i*4+1]) << 16) |
                       (static_cast<uint32_t>(msg[offset + i*4+2]) << 8) |
                       (static_cast<uint32_t>(msg[offset + i*4+3]));
            }
            for (int i = 16; i < 64; i++) {
                uint32_t s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >> 3);
                uint32_t s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >> 10);
                w[i] = w[i-16] + s0 + w[i-7] + s1;
            }

            uint32_t a=h[0], b=h[1], c=h[2], d=h[3], e=h[4], f=h[5], g=h[6], hh=h[7];
            for (int i = 0; i < 64; i++) {
                uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                uint32_t ch = (e & f) ^ (~e & g);
                uint32_t temp1 = hh + S1 + ch + K[i] + w[i];
                uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
                uint32_t temp2 = S0 + maj;
                hh=g; g=f; f=e; e=d+temp1; d=c; c=b; b=a; a=temp1+temp2;
            }
            h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
        }

        std::ostringstream oss;
        for (int i = 0; i < 8; i++)
            oss << std::hex << std::setfill('0') << std::setw(8) << h[i];
        return oss.str();
    }
};

class JsonValue {
public:
    enum Type { Null, Bool, Int, Float, String, Array, Object };

    JsonValue() : type_(Null) {}
    JsonValue(std::nullptr_t) : type_(Null) {}
    JsonValue(bool v) : type_(Bool), bool_val_(v) {}
    JsonValue(int v) : type_(Int), int_val_(static_cast<int64_t>(v)) {}
    JsonValue(int64_t v) : type_(Int), int_val_(v) {}
    JsonValue(double v) : type_(Float), float_val_(v) {}
    JsonValue(const char* v) : type_(String), str_val_(v) {}
    JsonValue(const std::string& v) : type_(String), str_val_(v) {}
    JsonValue(std::vector<JsonValue> v) : type_(Array), arr_val_(std::move(v)) {}
    JsonValue(std::map<std::string, JsonValue> v) : type_(Object), obj_val_(std::move(v)) {}

    static JsonValue null() { return JsonValue(); }
    static JsonValue array(std::vector<JsonValue> v) { return JsonValue(std::move(v)); }
    static JsonValue object(std::map<std::string, JsonValue> v) { return JsonValue(std::move(v)); }

    Type getType() const { return type_; }

    std::string canonicalize() const {
        switch (type_) {
            case Null: return "null";
            case Bool: return bool_val_ ? "true" : "false";
            case Int: return std::to_string(int_val_);
            case Float: return normalizeFloat(float_val_);
            case String: return escapeString(str_val_);
            case Array: {
                std::string result = "[";
                for (size_t i = 0; i < arr_val_.size(); i++) {
                    if (i > 0) result += ",";
                    result += arr_val_[i].canonicalize();
                }
                result += "]";
                return result;
            }
            case Object: {
                std::string result = "{";
                bool first = true;
                for (const auto& [key, val] : obj_val_) {
                    if (!first) result += ",";
                    first = false;
                    result += escapeString(key) + ":" + val.canonicalize();
                }
                result += "}";
                return result;
            }
        }
        return "null";
    }

    std::string computeHash() const {
        std::string canonical = canonicalize();
        return SovereignSHA256::hash(canonical);
    }

private:
    Type type_;
    bool bool_val_ = false;
    int64_t int_val_ = 0;
    double float_val_ = 0.0;
    std::string str_val_;
    std::vector<JsonValue> arr_val_;
    std::map<std::string, JsonValue> obj_val_;

    static std::string normalizeFloat(double v) {
        if (std::isinf(v) || std::isnan(v)) return "null";

        double intpart;
        if (std::modf(v, &intpart) == 0.0 && std::abs(v) < 1e15) {
            std::ostringstream oss;
            oss << std::fixed << std::setprecision(1) << v;
            return oss.str();
        }

        for (int prec = 1; prec <= 17; prec++) {
            char buf[64];
            int len = snprintf(buf, sizeof(buf), "%.*g", prec, v);
            std::string candidate(buf, len);
            double roundtrip = std::stod(candidate);
            if (roundtrip == v) {
                size_t dot = candidate.find('.');
                if (dot == std::string::npos && candidate.find('e') == std::string::npos) {
                    candidate += ".0";
                }
                return candidate;
            }
        }

        char buf[64];
        int len = snprintf(buf, sizeof(buf), "%.17g", v);
        return std::string(buf, len);
    }

    static std::string escapeString(const std::string& s) {
        std::string result = "\"";
        for (unsigned char c : s) {
            switch (c) {
                case '"':  result += "\\\""; break;
                case '\\': result += "\\\\"; break;
                case '\b': result += "\\b"; break;
                case '\f': result += "\\f"; break;
                case '\n': result += "\\n"; break;
                case '\r': result += "\\r"; break;
                case '\t': result += "\\t"; break;
                default:
                    if (c < 0x20) {
                        char hex[8];
                        snprintf(hex, sizeof(hex), "\\u%04x", c);
                        result += hex;
                    } else {
                        result += static_cast<char>(c);
                    }
                    break;
            }
        }
        result += "\"";
        return result;
    }
};

struct ChronosQueueEntry {
    std::string entityKey;
    std::string payloadJson;
    std::string payloadHash;
    int32_t stateVersion;
    int64_t timestamp;
    std::string userId;
    bool flushed;
};

class ChronosOfflineQueue {
public:
    void enqueue(const std::string& entityKey, const JsonValue& payload,
                 int32_t stateVersion, const std::string& userId) {
        ChronosQueueEntry entry;
        entry.entityKey = entityKey;
        entry.payloadJson = payload.canonicalize();
        entry.payloadHash = SovereignSHA256::hash(entry.payloadJson);
        entry.stateVersion = stateVersion;
        entry.timestamp = static_cast<int64_t>(std::time(nullptr));
        entry.userId = userId;
        entry.flushed = false;
        queue_.push_back(entry);
    }

    size_t pendingCount() const {
        size_t count = 0;
        for (const auto& e : queue_) if (!e.flushed) count++;
        return count;
    }

    const std::vector<ChronosQueueEntry>& entries() const { return queue_; }

    struct FlushResult {
        bool success;
        int32_t newStateVersion;
        std::string error;
    };

    using FlushCallback = std::function<FlushResult(const ChronosQueueEntry&)>;

    struct FlushReport {
        int succeeded;
        int conflicted;
        int failed;
        std::vector<std::string> errors;
    };

    FlushReport flush(FlushCallback callback) {
        FlushReport report{0, 0, 0, {}};
        for (auto& entry : queue_) {
            if (entry.flushed) continue;
            FlushResult result = callback(entry);
            if (result.success) {
                entry.flushed = true;
                entry.stateVersion = result.newStateVersion;
                report.succeeded++;
            } else if (result.error.find("409") != std::string::npos ||
                       result.error.find("CONFLICT") != std::string::npos) {
                entry.flushed = true;
                report.conflicted++;
                report.errors.push_back(result.error);
            } else {
                report.failed++;
                report.errors.push_back(result.error);
                break;
            }
        }
        return report;
    }

    bool saveToDisk(const std::string& filepath) const {
        std::ofstream out(filepath, std::ios::binary);
        if (!out) return false;
        uint32_t magic = 0x43485230;
        uint32_t version = 1;
        uint32_t count = static_cast<uint32_t>(queue_.size());
        out.write(reinterpret_cast<const char*>(&magic), 4);
        out.write(reinterpret_cast<const char*>(&version), 4);
        out.write(reinterpret_cast<const char*>(&count), 4);
        for (const auto& e : queue_) {
            writeString(out, e.entityKey);
            writeString(out, e.payloadJson);
            writeString(out, e.payloadHash);
            out.write(reinterpret_cast<const char*>(&e.stateVersion), 4);
            out.write(reinterpret_cast<const char*>(&e.timestamp), 8);
            writeString(out, e.userId);
            uint8_t f = e.flushed ? 1 : 0;
            out.write(reinterpret_cast<const char*>(&f), 1);
        }
        return true;
    }

    bool loadFromDisk(const std::string& filepath) {
        std::ifstream in(filepath, std::ios::binary);
        if (!in) return false;
        uint32_t magic, version, count;
        in.read(reinterpret_cast<char*>(&magic), 4);
        if (magic != 0x43485230) return false;
        in.read(reinterpret_cast<char*>(&version), 4);
        if (version != 1) return false;
        in.read(reinterpret_cast<char*>(&count), 4);
        queue_.clear();
        for (uint32_t i = 0; i < count; i++) {
            ChronosQueueEntry e;
            e.entityKey = readString(in);
            e.payloadJson = readString(in);
            e.payloadHash = readString(in);
            in.read(reinterpret_cast<char*>(&e.stateVersion), 4);
            in.read(reinterpret_cast<char*>(&e.timestamp), 8);
            e.userId = readString(in);
            uint8_t f;
            in.read(reinterpret_cast<char*>(&f), 1);
            e.flushed = (f != 0);
            queue_.push_back(e);
        }
        return true;
    }

    void clearFlushed() {
        queue_.erase(
            std::remove_if(queue_.begin(), queue_.end(),
                [](const ChronosQueueEntry& e) { return e.flushed; }),
            queue_.end()
        );
    }

private:
    std::vector<ChronosQueueEntry> queue_;

    static void writeString(std::ofstream& out, const std::string& s) {
        uint32_t len = static_cast<uint32_t>(s.size());
        out.write(reinterpret_cast<const char*>(&len), 4);
        out.write(s.data(), len);
    }

    static std::string readString(std::ifstream& in) {
        uint32_t len;
        in.read(reinterpret_cast<char*>(&len), 4);
        std::string s(len, '\0');
        in.read(s.data(), len);
        return s;
    }
};

}
