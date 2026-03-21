#include "../generated/SovereignSerializer.h"
#include <iostream>
#include <cassert>

using namespace Sovereign;

int passed = 0;
int failed = 0;

void assertHash(const std::string& name, const JsonValue& payload,
                const std::string& expectedCanonical, const std::string& expectedHash) {
    std::string canonical = payload.canonicalize();
    std::string hash = SovereignSHA256::hash(canonical);

    bool canonicalMatch = (canonical == expectedCanonical);
    bool hashMatch = (hash == expectedHash);

    if (canonicalMatch && hashMatch) {
        std::cout << "  PASS: " << name << std::endl;
        passed++;
    } else {
        std::cerr << "  FAIL: " << name << std::endl;
        if (!canonicalMatch) {
            std::cerr << "    CANONICAL EXPECTED: " << expectedCanonical << std::endl;
            std::cerr << "    CANONICAL GOT:      " << canonical << std::endl;
        }
        if (!hashMatch) {
            std::cerr << "    HASH EXPECTED: " << expectedHash << std::endl;
            std::cerr << "    HASH GOT:      " << hash << std::endl;
        }
        failed++;
    }
}

void testFlatSimple() {
    JsonValue payload = JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("alpha-001")},
        {"vehicle_id", JsonValue(1)},
    });
    assertHash("flat_simple", payload,
        "{\"amount\":50000.0,\"user_id\":\"alpha-001\",\"vehicle_id\":1}",
        "60971605356f53ed4e96379b2eeb24d6849e1d28ad2192fdf45af3abe80e1d36");
}

void testNestedDeep() {
    JsonValue payload = JsonValue::object({
        {"bid", JsonValue::object({
            {"amount", JsonValue(48500.0)},
            {"payload_hash", JsonValue::null()},
            {"state_version", JsonValue(3)},
            {"user_id", JsonValue("alpha-001")},
        })},
        {"metadata", JsonValue::object({
            {"source", JsonValue("native-client")},
            {"timestamp", JsonValue(1700000000)},
            {"version", JsonValue("5.0.0")},
        })},
        {"vehicle", JsonValue::object({
            {"color", JsonValue("silver")},
            {"dimensions", JsonValue::object({
                {"height", JsonValue(1690.0)},
                {"length", JsonValue(4890.5)},
                {"width", JsonValue(1895.0)},
            })},
            {"features", JsonValue::array({
                JsonValue("AWD"), JsonValue("sunroof"), JsonValue("leather"),
            })},
            {"id", JsonValue(1)},
            {"name", JsonValue("Lexus RX300")},
            {"price", JsonValue(52000.0)},
            {"year", JsonValue(2024)},
        })},
    });
    assertHash("nested_deep", payload,
        "{\"bid\":{\"amount\":48500.0,\"payload_hash\":null,\"state_version\":3,\"user_id\":\"alpha-001\"},\"metadata\":{\"source\":\"native-client\",\"timestamp\":1700000000,\"version\":\"5.0.0\"},\"vehicle\":{\"color\":\"silver\",\"dimensions\":{\"height\":1690.0,\"length\":4890.5,\"width\":1895.0},\"features\":[\"AWD\",\"sunroof\",\"leather\"],\"id\":1,\"name\":\"Lexus RX300\",\"price\":52000.0,\"year\":2024}}",
        "d6444f56f3d993bf1904999e615f281c3ee0c51f43bee9f3d011bf39332ad376");
}

void testNullHeavy() {
    JsonValue payload = JsonValue::object({
        {"a", JsonValue::null()},
        {"b", JsonValue::object({
            {"c", JsonValue::null()},
            {"d", JsonValue::array({JsonValue::null(), JsonValue(1), JsonValue::null()})},
        })},
        {"e", JsonValue::array({})},
    });
    assertHash("null_heavy", payload,
        "{\"a\":null,\"b\":{\"c\":null,\"d\":[null,1,null]},\"e\":[]}",
        "09c19ee33537b8c4e5bb106c70d70ae0cd293b3557301b0453b89ac034a9ec0f");
}

void testFloatEdgeCases() {
    JsonValue payload = JsonValue::object({
        {"fractional", JsonValue(3.14159)},
        {"large", JsonValue(999999999.0)},
        {"negative", JsonValue(-42.0)},
        {"small", JsonValue(0.001)},
        {"whole", JsonValue(1.0)},
        {"zero", JsonValue(0.0)},
    });
    assertHash("float_edge_cases", payload,
        "{\"fractional\":3.14159,\"large\":999999999.0,\"negative\":-42.0,\"small\":0.001,\"whole\":1.0,\"zero\":0.0}",
        "c17185638a062e64a786a50ac9a77fc5b09cebe36fdf294cef532abb3bd490f2");
}

void testUnicodeStress() {
    JsonValue payload = JsonValue::object({
        {"accents", JsonValue("\xc3\xa9\xc3\xa0\xc3\xbc\xc3\xb1")},
        {"cjk", JsonValue("\xe8\xb1\x8a\xe7\x94\xb0")},
        {"emoji", JsonValue("\xf0\x9f\x9a\x97")},
        {"name", JsonValue("Lexus\xc2\xae RX300\xe2\x84\xa2")},
    });
    assertHash("unicode_stress", payload,
        "{\"accents\":\"\xc3\xa9\xc3\xa0\xc3\xbc\xc3\xb1\",\"cjk\":\"\xe8\xb1\x8a\xe7\x94\xb0\",\"emoji\":\"\xf0\x9f\x9a\x97\",\"name\":\"Lexus\xc2\xae RX300\xe2\x84\xa2\"}",
        "34167558ecc0d0da22a0de016423f665defd61f839311b1abf821782af003a2d");
}

void testKeySortAdversarial() {
    JsonValue payload = JsonValue::object({
        {"ALPHA", JsonValue(5)},
        {"Beta", JsonValue(3)},
        {"alpha", JsonValue(2)},
        {"alpha2", JsonValue(4)},
        {"nested", JsonValue::object({
            {"a", JsonValue::object({{"x", JsonValue(1)}, {"y", JsonValue(2)}})},
            {"z", JsonValue::object({{"a", JsonValue(1)}, {"b", JsonValue(2)}})},
        })},
        {"zebra", JsonValue(1)},
    });
    assertHash("key_sort_adversarial", payload,
        "{\"ALPHA\":5,\"Beta\":3,\"alpha\":2,\"alpha2\":4,\"nested\":{\"a\":{\"x\":1,\"y\":2},\"z\":{\"a\":1,\"b\":2}},\"zebra\":1}",
        "0c8865f302c2dfe027e734bb5873711b936d8e650e277a63e1e785ce809ee390");
}

void testArrayOfObjects() {
    JsonValue payload = JsonValue::object({
        {"bids", JsonValue::array({
            JsonValue::object({{"amount", JsonValue(50000.0)}, {"user_id", JsonValue("user-a")}}),
            JsonValue::object({{"amount", JsonValue(55000.0)}, {"user_id", JsonValue("user-b")}}),
            JsonValue::object({{"amount", JsonValue(60000.0)}, {"user_id", JsonValue("user-c")}}),
        })},
    });
    assertHash("array_of_objects", payload,
        "{\"bids\":[{\"amount\":50000.0,\"user_id\":\"user-a\"},{\"amount\":55000.0,\"user_id\":\"user-b\"},{\"amount\":60000.0,\"user_id\":\"user-c\"}]}",
        "f43533fdf87474b9f07367a6d9aac5b42ba8bf2e849251f825a5cbeca3bae186");
}

void testIntegerTypes() {
    JsonValue payload = JsonValue::object({
        {"big_int", JsonValue(2147483647)},
        {"negative", JsonValue(-1)},
        {"small_int", JsonValue(1)},
        {"zero", JsonValue(0)},
    });
    assertHash("integer_types", payload,
        "{\"big_int\":2147483647,\"negative\":-1,\"small_int\":1,\"zero\":0}",
        "c7960f3244393f08a05f0e823b6c0b914ee2db54edc52f5380e4c2eb9c6f0933");
}

void testEmptyStructures() {
    JsonValue payload = JsonValue::object({
        {"empty_arr", JsonValue::array({})},
        {"empty_obj", JsonValue::object({})},
        {"empty_str", JsonValue("")},
    });
    assertHash("empty_structures", payload,
        "{\"empty_arr\":[],\"empty_obj\":{},\"empty_str\":\"\"}",
        "2a8781af9ac37e30b45f58e83894528acb1472c33bdf4c2ef0d6b6d86e4f190f");
}

void testBooleanAndMixed() {
    JsonValue payload = JsonValue::object({
        {"active", JsonValue(true)},
        {"count", JsonValue(0)},
        {"deleted", JsonValue(false)},
        {"label", JsonValue("test")},
        {"value", JsonValue::null()},
    });
    assertHash("boolean_and_mixed", payload,
        "{\"active\":true,\"count\":0,\"deleted\":false,\"label\":\"test\",\"value\":null}",
        "7733110ce9039db3573807c762e736d809344a28b933ebe8df211a1509460798");
}

void testChronosQueue() {
    std::cout << "\n=== Module 3: Chronos Offline Queue ===" << std::endl;

    ChronosOfflineQueue queue;
    JsonValue bid1 = JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("test-user")},
        {"vehicle_id", JsonValue(1)},
    });
    JsonValue bid2 = JsonValue::object({
        {"amount", JsonValue(55000.0)},
        {"user_id", JsonValue("test-user")},
        {"vehicle_id", JsonValue(1)},
    });

    queue.enqueue("vehicle:1:bids", bid1, 1, "test-user");
    queue.enqueue("vehicle:1:bids", bid2, 2, "test-user");

    if (queue.pendingCount() == 2) {
        std::cout << "  PASS: Chronos enqueue — 2 entries pending" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos enqueue" << std::endl; failed++; }

    if (queue.entries()[0].payloadHash == SovereignSHA256::hash(bid1.canonicalize())) {
        std::cout << "  PASS: Chronos hash integrity — entry hash matches payload" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos hash integrity" << std::endl; failed++; }

    std::string testPath = "/tmp/chronos_test.bin";
    if (queue.saveToDisk(testPath)) {
        std::cout << "  PASS: Chronos saveToDisk" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos saveToDisk" << std::endl; failed++; }

    ChronosOfflineQueue loaded;
    if (loaded.loadFromDisk(testPath) && loaded.pendingCount() == 2) {
        std::cout << "  PASS: Chronos loadFromDisk — 2 entries restored" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos loadFromDisk" << std::endl; failed++; }

    if (loaded.entries()[0].payloadHash == queue.entries()[0].payloadHash) {
        std::cout << "  PASS: Chronos persistence parity — hashes survive serialization" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos persistence parity" << std::endl; failed++; }

    int flushCount = 0;
    auto report = loaded.flush([&](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        flushCount++;
        return {true, entry.stateVersion + 1, ""};
    });
    if (report.succeeded == 2 && report.conflicted == 0 && report.failed == 0) {
        std::cout << "  PASS: Chronos flush — 2 succeeded, 0 conflicts" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos flush" << std::endl; failed++; }

    if (loaded.pendingCount() == 0) {
        std::cout << "  PASS: Chronos post-flush — 0 pending" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos post-flush" << std::endl; failed++; }

    ChronosOfflineQueue conflictQueue;
    conflictQueue.enqueue("vehicle:1:bids", bid1, 1, "stale-user");
    auto conflictReport = conflictQueue.flush([](const ChronosQueueEntry&) -> ChronosOfflineQueue::FlushResult {
        return {false, 0, "409 STATE_VERSION_CONFLICT"};
    });
    if (conflictReport.conflicted == 1 && conflictReport.succeeded == 0) {
        std::cout << "  PASS: Chronos conflict detection — 409 handled" << std::endl;
        passed++;
    } else { std::cerr << "  FAIL: Chronos conflict detection" << std::endl; failed++; }

    std::remove(testPath.c_str());
}

void testSHA256Standalone() {
    std::cout << "\n=== SHA-256 Standalone Verification ===" << std::endl;

    std::string empty_hash = SovereignSHA256::hash("");
    if (empty_hash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") {
        std::cout << "  PASS: SHA-256 empty string" << std::endl; passed++;
    } else { std::cerr << "  FAIL: SHA-256 empty string: " << empty_hash << std::endl; failed++; }

    std::string abc_hash = SovereignSHA256::hash("abc");
    if (abc_hash == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") {
        std::cout << "  PASS: SHA-256 'abc'" << std::endl; passed++;
    } else { std::cerr << "  FAIL: SHA-256 'abc': " << abc_hash << std::endl; failed++; }

    std::string long_hash = SovereignSHA256::hash("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq");
    if (long_hash == "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1") {
        std::cout << "  PASS: SHA-256 NIST vector" << std::endl; passed++;
    } else { std::cerr << "  FAIL: SHA-256 NIST vector: " << long_hash << std::endl; failed++; }
}

int main() {
    std::cout << "=== Module 1: Golden Hash Conformance Test ===" << std::endl;
    std::cout << "=== Module 2: Sovereign C++ Serializer ===" << std::endl;

    testSHA256Standalone();

    std::cout << "\n=== Hell Payload Conformance ===" << std::endl;
    testFlatSimple();
    testNestedDeep();
    testNullHeavy();
    testFloatEdgeCases();
    testUnicodeStress();
    testKeySortAdversarial();
    testArrayOfObjects();
    testIntegerTypes();
    testEmptyStructures();
    testBooleanAndMixed();

    testChronosQueue();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
