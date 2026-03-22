#pragma once

#include "SovereignPassport.h"
#include "SovereignVisualSynthesizer.h"
#include <string>
#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <mutex>
#include <functional>
#include <cstdint>
#include <unordered_map>
#include <unordered_set>
#include <ctime>
#include <sstream>
#include <regex>
#include <chrono>

namespace Sovereign {

enum class IntentCategory {
    COMBAT,
    TRADE,
    MOVEMENT,
    QUERY,
    CONFIGURATION,
    SOCIAL,
    SYSTEM,
    UNKNOWN
};

inline std::string intentCategoryToString(IntentCategory c) {
    switch (c) {
        case IntentCategory::COMBAT:        return "COMBAT";
        case IntentCategory::TRADE:         return "TRADE";
        case IntentCategory::MOVEMENT:      return "MOVEMENT";
        case IntentCategory::QUERY:         return "QUERY";
        case IntentCategory::CONFIGURATION: return "CONFIGURATION";
        case IntentCategory::SOCIAL:        return "SOCIAL";
        case IntentCategory::SYSTEM:        return "SYSTEM";
        default: return "UNKNOWN";
    }
}

enum class ValidationResult {
    APPROVED,
    REJECTED_BOUNDARY_VIOLATION,
    REJECTED_LIQUIDITY_EXCEEDED,
    REJECTED_OWNERSHIP_LOCKED,
    REJECTED_COOLDOWN_ACTIVE,
    REJECTED_INVALID_TARGET,
    REJECTED_SANITIZATION_FAILED,
    REJECTED_INTEGRITY_FAILURE,
    REJECTED_EMPTY_INTENT,
    REJECTED_MALFORMED_INTENT
};

inline std::string validationResultToString(ValidationResult r) {
    switch (r) {
        case ValidationResult::APPROVED:                      return "APPROVED";
        case ValidationResult::REJECTED_BOUNDARY_VIOLATION:   return "REJECTED_BOUNDARY_VIOLATION";
        case ValidationResult::REJECTED_LIQUIDITY_EXCEEDED:   return "REJECTED_LIQUIDITY_EXCEEDED";
        case ValidationResult::REJECTED_OWNERSHIP_LOCKED:     return "REJECTED_OWNERSHIP_LOCKED";
        case ValidationResult::REJECTED_COOLDOWN_ACTIVE:      return "REJECTED_COOLDOWN_ACTIVE";
        case ValidationResult::REJECTED_INVALID_TARGET:       return "REJECTED_INVALID_TARGET";
        case ValidationResult::REJECTED_SANITIZATION_FAILED:  return "REJECTED_SANITIZATION_FAILED";
        case ValidationResult::REJECTED_INTEGRITY_FAILURE:    return "REJECTED_INTEGRITY_FAILURE";
        case ValidationResult::REJECTED_EMPTY_INTENT:         return "REJECTED_EMPTY_INTENT";
        case ValidationResult::REJECTED_MALFORMED_INTENT:     return "REJECTED_MALFORMED_INTENT";
        default: return "UNKNOWN";
    }
}

struct FSovereignActionStruct {
    ActionType actionType       = ActionType::HOLD;
    std::string actionTypeName  = "HOLD";
    IntentCategory category     = IntentCategory::UNKNOWN;
    std::string categoryName    = "UNKNOWN";

    std::string sourceEntityHash;
    std::string targetEntityHash;

    float amountCredits  = 0.0f;
    float positionX      = 0.0f;
    float positionY      = 0.0f;
    float positionZ      = 0.0f;
    float intensity      = 1.0f;

    std::string rawIntent;
    std::string sanitizedIntent;
    int64_t timestamp = 0;
    std::string actionHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"actionType\":\"" << actionTypeName << "\""
            << ",\"amountCredits\":" << std::fixed << std::setprecision(2) << amountCredits
            << ",\"category\":\"" << categoryName << "\""
            << ",\"intensity\":" << std::setprecision(6) << intensity
            << ",\"positionX\":" << positionX
            << ",\"positionY\":" << positionY
            << ",\"positionZ\":" << positionZ
            << ",\"sourceEntityHash\":\"" << sourceEntityHash << "\""
            << ",\"targetEntityHash\":\"" << targetEntityHash << "\""
            << ",\"timestamp\":" << timestamp
            << "}";
        return oss.str();
    }

    void updateHash() {
        actionHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !actionHash.empty() && actionHash == SovereignSHA256::hash(canonicalize());
    }
};

struct FValidationReport {
    ValidationResult result = ValidationResult::REJECTED_EMPTY_INTENT;
    std::string resultName  = "REJECTED_EMPTY_INTENT";
    std::string reason;

    FSovereignActionStruct action;
    std::string validatorHash;
    int passesChecked       = 0;
    int violationsFound     = 0;
    float validationTimeMs  = 0.0f;
    int64_t timestamp       = 0;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"action\":" << action.canonicalize()
            << ",\"passesChecked\":" << passesChecked
            << ",\"reason\":\"" << reason << "\""
            << ",\"result\":\"" << resultName << "\""
            << ",\"timestamp\":" << timestamp
            << ",\"violationsFound\":" << violationsFound
            << "}";
        return oss.str();
    }

    void updateHash() {
        validatorHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !validatorHash.empty() && validatorHash == SovereignSHA256::hash(canonicalize());
    }

    bool isApproved() const {
        return result == ValidationResult::APPROVED;
    }
};

struct FIntentSanitizationResult {
    std::string originalIntent;
    std::string sanitizedAction;
    std::string extractedVerb;
    std::string extractedTarget;
    float extractedAmount   = 0.0f;
    bool isValid            = false;
    int slopTokensStripped  = 0;
    int totalTokens         = 0;
    float slopRatio         = 0.0f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"extractedAmount\":" << std::fixed << std::setprecision(2) << extractedAmount
            << ",\"extractedTarget\":\"" << extractedTarget << "\""
            << ",\"extractedVerb\":\"" << extractedVerb << "\""
            << ",\"isValid\":" << (isValid ? "true" : "false")
            << ",\"sanitizedAction\":\"" << sanitizedAction << "\""
            << ",\"slopRatio\":" << std::setprecision(4) << slopRatio
            << ",\"slopTokensStripped\":" << slopTokensStripped
            << ",\"totalTokens\":" << totalTokens
            << "}";
        return oss.str();
    }
};

struct FBehavioralMirrorState {
    std::string entityHash;
    std::string lastAction     = "HOLD";
    bool isPredicted           = false;
    bool isConfirmed           = false;
    bool isRolledBack          = false;
    int64_t predictionTimestamp = 0;
    int64_t confirmTimestamp    = 0;
    int64_t rollbackTimestamp   = 0;
    int rollbackCount          = 0;
    int confirmCount           = 0;
    int predictionCount        = 0;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"confirmCount\":" << confirmCount
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"isConfirmed\":" << (isConfirmed ? "true" : "false")
            << ",\"isPredicted\":" << (isPredicted ? "true" : "false")
            << ",\"isRolledBack\":" << (isRolledBack ? "true" : "false")
            << ",\"lastAction\":\"" << lastAction << "\""
            << ",\"predictionCount\":" << predictionCount
            << ",\"rollbackCount\":" << rollbackCount
            << "}";
        return oss.str();
    }
};

struct FSynapseConstraints {
    float maxBidCredits        = 1000000.0f;
    float minBidCredits        = 0.01f;
    float maxPositionRadius    = 10000.0f;
    float maxIntensity         = 10.0f;
    float cooldownMs           = 100.0f;
    int   maxActionsPerSecond  = 60;
    float maxSlopRatio         = 0.8f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"cooldownMs\":" << std::fixed << std::setprecision(2) << cooldownMs
            << ",\"maxActionsPerSecond\":" << maxActionsPerSecond
            << ",\"maxBidCredits\":" << maxBidCredits
            << ",\"maxIntensity\":" << std::setprecision(1) << maxIntensity
            << ",\"maxPositionRadius\":" << maxPositionRadius
            << ",\"maxSlopRatio\":" << std::setprecision(2) << maxSlopRatio
            << ",\"minBidCredits\":" << minBidCredits
            << "}";
        return oss.str();
    }
};

struct FSynapseStats {
    int totalIntentsProcessed   = 0;
    int totalApproved           = 0;
    int totalRejected           = 0;
    int totalSanitized          = 0;
    int totalSlopStripped       = 0;
    int totalBoundaryViolations = 0;
    int totalLiquidityExceeded  = 0;
    int totalCooldownBlocked    = 0;
    int totalEmptyIntents       = 0;
    int totalMalformed          = 0;
    int totalRollbacks          = 0;
    int totalPredictions        = 0;
    int totalConfirmations      = 0;
    float avgValidationTimeMs   = 0.0f;
    float totalValidationTimeMs = 0.0f;

    std::unordered_map<std::string, int> actionCounts;
    std::unordered_map<std::string, int> categoryCounts;
    std::unordered_map<std::string, int> rejectionCounts;
};

using IntentProcessedDelegate = std::function<void(const FValidationReport&, const std::string& entityKey)>;
using RollbackDelegate = std::function<void(const FBehavioralMirrorState&, const std::string& reason)>;

static const std::unordered_set<std::string> SLOP_TOKENS = {
    "i'd", "love", "to", "help", "you", "let", "me", "certainly",
    "of", "course", "absolutely", "sure", "happy", "glad", "great",
    "wonderful", "amazing", "fantastic", "please", "kindly", "just",
    "simply", "actually", "really", "basically", "honestly", "literally",
    "obviously", "clearly", "definitely", "I", "i", "my", "your",
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can",
    "this", "that", "these", "those", "it", "its", "for", "with",
    "at", "by", "from", "in", "on", "as", "into", "about"
};

static const std::unordered_map<std::string, ActionType> VERB_TO_ACTION = {
    {"strike",   ActionType::STRIKE},
    {"attack",   ActionType::STRIKE},
    {"hit",      ActionType::STRIKE},
    {"punch",    ActionType::STRIKE},
    {"slash",    ActionType::STRIKE},
    {"guard",    ActionType::GUARD},
    {"defend",   ActionType::GUARD},
    {"block",    ActionType::GUARD},
    {"shield",   ActionType::GUARD},
    {"protect",  ActionType::GUARD},
    {"flank",    ActionType::FLANK},
    {"surround", ActionType::FLANK},
    {"charge",   ActionType::CHARGE},
    {"rush",     ActionType::CHARGE},
    {"sprint",   ActionType::CHARGE},
    {"retreat",  ActionType::RETREAT},
    {"flee",     ActionType::RETREAT},
    {"withdraw", ActionType::RETREAT},
    {"run",      ActionType::RETREAT},
    {"counter",  ActionType::COUNTER},
    {"parry",    ActionType::COUNTER},
    {"riposte",  ActionType::COUNTER},
    {"feint",    ActionType::FEINT},
    {"fake",     ActionType::FEINT},
    {"bluff",    ActionType::FEINT},
    {"hold",     ActionType::HOLD},
    {"wait",     ActionType::HOLD},
    {"stay",     ActionType::HOLD}
};

static const std::unordered_map<std::string, IntentCategory> VERB_TO_CATEGORY = {
    {"buy",       IntentCategory::TRADE},
    {"sell",      IntentCategory::TRADE},
    {"bid",       IntentCategory::TRADE},
    {"trade",     IntentCategory::TRADE},
    {"purchase",  IntentCategory::TRADE},
    {"offer",     IntentCategory::TRADE},
    {"move",      IntentCategory::MOVEMENT},
    {"go",        IntentCategory::MOVEMENT},
    {"walk",      IntentCategory::MOVEMENT},
    {"teleport",  IntentCategory::MOVEMENT},
    {"jump",      IntentCategory::MOVEMENT},
    {"query",     IntentCategory::QUERY},
    {"check",     IntentCategory::QUERY},
    {"inspect",   IntentCategory::QUERY},
    {"look",      IntentCategory::QUERY},
    {"examine",   IntentCategory::QUERY},
    {"configure", IntentCategory::CONFIGURATION},
    {"set",       IntentCategory::CONFIGURATION},
    {"adjust",    IntentCategory::CONFIGURATION},
    {"modify",    IntentCategory::CONFIGURATION},
    {"change",    IntentCategory::CONFIGURATION},
    {"greet",     IntentCategory::SOCIAL},
    {"wave",      IntentCategory::SOCIAL},
    {"emote",     IntentCategory::SOCIAL},
    {"say",       IntentCategory::SOCIAL},
    {"chat",      IntentCategory::SOCIAL}
};

class SovereignSynapse {
public:
    static SovereignSynapse& Get() {
        static SovereignSynapse instance;
        return instance;
    }

    FIntentSanitizationResult sanitizeIntent(const std::string& rawIntent) {
        FIntentSanitizationResult result;
        result.originalIntent = rawIntent;

        if (rawIntent.empty()) {
            result.isValid = false;
            return result;
        }

        std::vector<std::string> tokens = tokenize(rawIntent);
        result.totalTokens = static_cast<int>(tokens.size());

        if (tokens.empty()) {
            result.isValid = false;
            return result;
        }

        std::vector<std::string> meaningful;
        int slopCount = 0;
        for (const auto& token : tokens) {
            std::string lower = toLower(token);
            lower.erase(std::remove_if(lower.begin(), lower.end(),
                [](char c) { return c == ',' || c == '.' || c == '!' || c == '?' || c == '\'' || c == '"' || c == ':' || c == ';'; }),
                lower.end());
            if (lower.empty()) continue;
            if (SLOP_TOKENS.count(lower)) {
                slopCount++;
            } else {
                meaningful.push_back(lower);
            }
        }

        result.slopTokensStripped = slopCount;
        result.slopRatio = result.totalTokens > 0 ? static_cast<float>(slopCount) / result.totalTokens : 0.0f;

        if (meaningful.empty()) {
            result.isValid = false;
            return result;
        }

        for (const auto& word : meaningful) {
            if (VERB_TO_ACTION.count(word)) {
                result.extractedVerb = word;
                break;
            }
            if (VERB_TO_CATEGORY.count(word)) {
                result.extractedVerb = word;
                break;
            }
        }

        if (result.extractedVerb.empty()) {
            result.extractedVerb = meaningful[0];
        }

        for (const auto& word : meaningful) {
            if (word != result.extractedVerb && !isNumeric(word)) {
                result.extractedTarget = word;
                break;
            }
        }

        for (const auto& word : meaningful) {
            if (isNumeric(word)) {
                result.extractedAmount = std::stof(word);
                break;
            }
        }

        for (const auto& token : tokens) {
            std::string lower = toLower(token);
            if (lower.front() == '$') {
                std::string numPart = lower.substr(1);
                numPart.erase(std::remove(numPart.begin(), numPart.end(), ','), numPart.end());
                if (!numPart.empty() && isNumeric(numPart)) {
                    result.extractedAmount = std::stof(numPart);
                }
            }
        }

        std::ostringstream actionStr;
        std::string upperVerb = toUpper(result.extractedVerb);
        actionStr << upperVerb << "_ACTION";
        if (!result.extractedTarget.empty()) {
            actionStr << "(target=" << result.extractedTarget;
            if (result.extractedAmount > 0.0f) {
                actionStr << ",amount=" << std::fixed << std::setprecision(2) << result.extractedAmount;
            }
            actionStr << ")";
        } else if (result.extractedAmount > 0.0f) {
            actionStr << "(amount=" << std::fixed << std::setprecision(2) << result.extractedAmount << ")";
        }

        result.sanitizedAction = actionStr.str();
        result.isValid = true;

        std::lock_guard<std::mutex> lock(statsMutex_);
        stats_.totalSanitized++;
        stats_.totalSlopStripped += slopCount;

        return result;
    }

    FSovereignActionStruct buildActionStruct(const FIntentSanitizationResult& sanitized,
                                              const std::string& sourceEntityHash,
                                              const std::string& targetEntityHash = "") {
        FSovereignActionStruct action;
        action.rawIntent = sanitized.originalIntent;
        action.sanitizedIntent = sanitized.sanitizedAction;
        action.sourceEntityHash = sourceEntityHash;
        action.targetEntityHash = targetEntityHash;
        action.amountCredits = sanitized.extractedAmount;
        action.timestamp = std::time(nullptr);

        if (VERB_TO_ACTION.count(sanitized.extractedVerb)) {
            action.actionType = VERB_TO_ACTION.at(sanitized.extractedVerb);
            action.actionTypeName = actionTypeToString(action.actionType);
            action.category = IntentCategory::COMBAT;
            action.categoryName = "COMBAT";
        } else if (VERB_TO_CATEGORY.count(sanitized.extractedVerb)) {
            action.category = VERB_TO_CATEGORY.at(sanitized.extractedVerb);
            action.categoryName = intentCategoryToString(action.category);
            action.actionType = ActionType::HOLD;
            action.actionTypeName = "HOLD";
        } else {
            action.category = IntentCategory::UNKNOWN;
            action.categoryName = "UNKNOWN";
            action.actionType = ActionType::HOLD;
            action.actionTypeName = "HOLD";
        }

        action.updateHash();
        return action;
    }

    FValidationReport validateAction(const FSovereignActionStruct& action,
                                     const FSovereignPassport& passport,
                                     const FSynapseConstraints& constraints = FSynapseConstraints()) {
        auto startTime = std::chrono::high_resolution_clock::now();

        FValidationReport report;
        report.action = action;
        report.timestamp = std::time(nullptr);
        report.passesChecked = 0;

        report.passesChecked++;
        if (action.rawIntent.empty()) {
            report.result = ValidationResult::REJECTED_EMPTY_INTENT;
            report.resultName = validationResultToString(report.result);
            report.reason = "Empty intent string received";
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        if (action.sanitizedIntent.empty()) {
            report.result = ValidationResult::REJECTED_SANITIZATION_FAILED;
            report.resultName = validationResultToString(report.result);
            report.reason = "Sanitization produced empty action";
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        if (!action.verifyIntegrity()) {
            report.result = ValidationResult::REJECTED_INTEGRITY_FAILURE;
            report.resultName = validationResultToString(report.result);
            report.reason = "Action hash integrity check failed";
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        if (!passport.verifyFull()) {
            report.result = ValidationResult::REJECTED_INTEGRITY_FAILURE;
            report.resultName = validationResultToString(report.result);
            report.reason = "Passport integrity check failed";
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        if (action.sourceEntityHash.empty()) {
            report.result = ValidationResult::REJECTED_INVALID_TARGET;
            report.resultName = validationResultToString(report.result);
            report.reason = "Source entity hash is empty";
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        float posRadius = std::sqrt(action.positionX * action.positionX +
                                     action.positionY * action.positionY +
                                     action.positionZ * action.positionZ);
        if (posRadius > constraints.maxPositionRadius) {
            report.result = ValidationResult::REJECTED_BOUNDARY_VIOLATION;
            report.resultName = validationResultToString(report.result);
            report.reason = "Position radius " + std::to_string(posRadius) +
                            " exceeds max " + std::to_string(constraints.maxPositionRadius);
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        if (action.category == IntentCategory::TRADE) {
            if (action.amountCredits > constraints.maxBidCredits) {
                report.result = ValidationResult::REJECTED_LIQUIDITY_EXCEEDED;
                report.resultName = validationResultToString(report.result);
                report.reason = "Bid amount " + std::to_string(action.amountCredits) +
                                " exceeds max liquidity " + std::to_string(constraints.maxBidCredits);
                report.violationsFound = 1;
                finalizeReport(report, startTime, constraints);
                return report;
            }
            if (action.amountCredits < constraints.minBidCredits) {
                report.result = ValidationResult::REJECTED_LIQUIDITY_EXCEEDED;
                report.resultName = validationResultToString(report.result);
                report.reason = "Bid amount below minimum " + std::to_string(constraints.minBidCredits);
                report.violationsFound = 1;
                finalizeReport(report, startTime, constraints);
                return report;
            }
        }

        report.passesChecked++;
        if (action.intensity > constraints.maxIntensity) {
            report.result = ValidationResult::REJECTED_BOUNDARY_VIOLATION;
            report.resultName = validationResultToString(report.result);
            report.reason = "Intensity " + std::to_string(action.intensity) +
                            " exceeds max " + std::to_string(constraints.maxIntensity);
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.passesChecked++;
        {
            std::lock_guard<std::mutex> lock(cooldownMutex_);
            auto it = lastActionTimestamp_.find(action.sourceEntityHash);
            if (it != lastActionTimestamp_.end()) {
                auto now = std::chrono::high_resolution_clock::now();
                float elapsedMs = std::chrono::duration<float, std::milli>(now - it->second).count();
                if (elapsedMs < constraints.cooldownMs) {
                    report.result = ValidationResult::REJECTED_COOLDOWN_ACTIVE;
                    report.resultName = validationResultToString(report.result);
                    report.reason = "Cooldown active: " + std::to_string(elapsedMs) +
                                    "ms elapsed, need " + std::to_string(constraints.cooldownMs) + "ms";
                    report.violationsFound = 1;
                    finalizeReport(report, startTime, constraints);
                    return report;
                }
            }
        }

        report.passesChecked++;
        if (action.category == IntentCategory::TRADE && action.targetEntityHash.empty()) {
            report.result = ValidationResult::REJECTED_INVALID_TARGET;
            report.resultName = validationResultToString(report.result);
            report.reason = "Trade action requires a target entity";
            report.violationsFound = 1;
            finalizeReport(report, startTime, constraints);
            return report;
        }

        report.result = ValidationResult::APPROVED;
        report.resultName = "APPROVED";
        report.reason = "All 10 validation passes cleared";
        report.violationsFound = 0;

        {
            std::lock_guard<std::mutex> lock(cooldownMutex_);
            lastActionTimestamp_[action.sourceEntityHash] = std::chrono::high_resolution_clock::now();
        }

        finalizeReport(report, startTime, constraints);
        return report;
    }

    FValidationReport processIntent(const std::string& rawIntent,
                                     const FSovereignPassport& passport,
                                     const std::string& targetEntityHash = "",
                                     const FSynapseConstraints& constraints = FSynapseConstraints()) {
        auto sanitized = sanitizeIntent(rawIntent);

        if (!sanitized.isValid) {
            FValidationReport report;
            report.action.rawIntent = rawIntent;
            report.action.sourceEntityHash = passport.genomeHash;
            report.timestamp = std::time(nullptr);
            report.passesChecked = 1;
            report.violationsFound = 1;

            if (rawIntent.empty()) {
                report.result = ValidationResult::REJECTED_EMPTY_INTENT;
                report.resultName = "REJECTED_EMPTY_INTENT";
                report.reason = "Intent string is empty";
            } else {
                report.result = ValidationResult::REJECTED_MALFORMED_INTENT;
                report.resultName = "REJECTED_MALFORMED_INTENT";
                report.reason = "Could not extract meaningful tokens from intent";
            }

            report.updateHash();

            std::lock_guard<std::mutex> lock(statsMutex_);
            stats_.totalIntentsProcessed++;
            stats_.totalRejected++;
            if (rawIntent.empty()) stats_.totalEmptyIntents++;
            else stats_.totalMalformed++;
            stats_.rejectionCounts[report.resultName]++;

            if (intentDelegate_) {
                intentDelegate_(report, passport.entityKey);
            }

            return report;
        }

        if (sanitized.slopRatio > constraints.maxSlopRatio) {
            FValidationReport report;
            report.action.rawIntent = rawIntent;
            report.action.sanitizedIntent = sanitized.sanitizedAction;
            report.action.sourceEntityHash = passport.genomeHash;
            report.timestamp = std::time(nullptr);
            report.passesChecked = 2;
            report.violationsFound = 1;
            report.result = ValidationResult::REJECTED_SANITIZATION_FAILED;
            report.resultName = "REJECTED_SANITIZATION_FAILED";
            report.reason = "Slop ratio " + std::to_string(sanitized.slopRatio) +
                            " exceeds max " + std::to_string(constraints.maxSlopRatio);
            report.updateHash();

            std::lock_guard<std::mutex> lock(statsMutex_);
            stats_.totalIntentsProcessed++;
            stats_.totalRejected++;
            stats_.rejectionCounts[report.resultName]++;

            if (intentDelegate_) {
                intentDelegate_(report, passport.entityKey);
            }

            return report;
        }

        auto action = buildActionStruct(sanitized, passport.genomeHash, targetEntityHash);
        auto report = validateAction(action, passport, constraints);

        {
            std::lock_guard<std::mutex> lock(statsMutex_);
            stats_.totalIntentsProcessed++;
            if (report.isApproved()) {
                stats_.totalApproved++;
                stats_.actionCounts[action.actionTypeName]++;
                stats_.categoryCounts[action.categoryName]++;
            } else {
                stats_.totalRejected++;
                stats_.rejectionCounts[report.resultName]++;
            }
        }

        if (intentDelegate_) {
            intentDelegate_(report, passport.entityKey);
        }

        return report;
    }

    FBehavioralMirrorState predictAction(const std::string& entityHash,
                                          const std::string& actionName) {
        FBehavioralMirrorState result;
        {
            std::lock_guard<std::mutex> lock(mirrorMutex_);
            auto& state = mirrorStates_[entityHash];
            state.entityHash = entityHash;
            state.lastAction = actionName;
            state.isPredicted = true;
            state.isConfirmed = false;
            state.isRolledBack = false;
            state.predictionTimestamp = std::time(nullptr);
            state.predictionCount++;
            result = state;
        }

        {
            std::lock_guard<std::mutex> slock(statsMutex_);
            stats_.totalPredictions++;
        }

        return result;
    }

    FBehavioralMirrorState confirmAction(const std::string& entityHash) {
        FBehavioralMirrorState result;
        {
            std::lock_guard<std::mutex> lock(mirrorMutex_);
            auto it = mirrorStates_.find(entityHash);
            if (it == mirrorStates_.end()) {
                result.entityHash = entityHash;
                return result;
            }

            auto& state = it->second;
            state.isConfirmed = true;
            state.isPredicted = false;
            state.isRolledBack = false;
            state.confirmTimestamp = std::time(nullptr);
            state.confirmCount++;
            result = state;
        }

        {
            std::lock_guard<std::mutex> slock(statsMutex_);
            stats_.totalConfirmations++;
        }

        return result;
    }

    FBehavioralMirrorState rollbackAction(const std::string& entityHash, const std::string& reason = "") {
        FBehavioralMirrorState result;
        {
            std::lock_guard<std::mutex> lock(mirrorMutex_);
            auto it = mirrorStates_.find(entityHash);
            if (it == mirrorStates_.end()) {
                result.entityHash = entityHash;
                return result;
            }

            auto& state = it->second;
            state.isRolledBack = true;
            state.isPredicted = false;
            state.isConfirmed = false;
            state.rollbackTimestamp = std::time(nullptr);
            state.rollbackCount++;
            state.lastAction = "HOLD";
            result = state;
        }

        {
            std::lock_guard<std::mutex> slock(statsMutex_);
            stats_.totalRollbacks++;
        }

        if (rollbackDelegate_) {
            rollbackDelegate_(result, reason);
        }

        return result;
    }

    FBehavioralMirrorState predictAndValidate(const std::string& rawIntent,
                                                const FSovereignPassport& passport,
                                                const std::string& targetEntityHash = "",
                                                const FSynapseConstraints& constraints = FSynapseConstraints()) {
        auto sanitized = sanitizeIntent(rawIntent);
        std::string actionName = sanitized.isValid ? toUpper(sanitized.extractedVerb) : "HOLD";

        auto prediction = predictAction(passport.genomeHash, actionName);

        auto report = processIntent(rawIntent, passport, targetEntityHash, constraints);

        if (!report.isApproved()) {
            return rollbackAction(passport.genomeHash, report.reason);
        }

        return confirmAction(passport.genomeHash);
    }

    FBehavioralMirrorState getMirrorState(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(mirrorMutex_);
        auto it = mirrorStates_.find(entityHash);
        if (it != mirrorStates_.end()) return it->second;
        FBehavioralMirrorState empty;
        empty.entityHash = entityHash;
        return empty;
    }

    void clearCooldowns() {
        std::lock_guard<std::mutex> lock(cooldownMutex_);
        lastActionTimestamp_.clear();
    }

    void onIntentProcessed(IntentProcessedDelegate delegate) {
        intentDelegate_ = delegate;
    }

    void onRollback(RollbackDelegate delegate) {
        rollbackDelegate_ = delegate;
    }

    FSynapseStats getStats() {
        std::lock_guard<std::mutex> lock(statsMutex_);
        return stats_;
    }

    void resetStats() {
        std::lock_guard<std::mutex> lock(statsMutex_);
        stats_ = FSynapseStats();
        {
            std::lock_guard<std::mutex> mlock(mirrorMutex_);
            mirrorStates_.clear();
        }
        clearCooldowns();
    }

    std::string generateUE5SynapseCode() const {
        std::ostringstream oss;
        oss << "// Auto-generated UE5 Sovereign Synapse\n";
        oss << "#pragma once\n\n";
        oss << "#include \"CoreMinimal.h\"\n";
        oss << "#include \"SovereignSynapse.generated.h\"\n\n";

        oss << "UENUM(BlueprintType)\n";
        oss << "enum class ESovereignIntentCategory : uint8 {\n";
        oss << "    COMBAT       UMETA(DisplayName = \"Combat\"),\n";
        oss << "    TRADE        UMETA(DisplayName = \"Trade\"),\n";
        oss << "    MOVEMENT     UMETA(DisplayName = \"Movement\"),\n";
        oss << "    QUERY        UMETA(DisplayName = \"Query\"),\n";
        oss << "    CONFIGURATION UMETA(DisplayName = \"Configuration\"),\n";
        oss << "    SOCIAL       UMETA(DisplayName = \"Social\"),\n";
        oss << "    SYSTEM       UMETA(DisplayName = \"System\"),\n";
        oss << "    UNKNOWN      UMETA(DisplayName = \"Unknown\")\n";
        oss << "};\n\n";

        oss << "UENUM(BlueprintType)\n";
        oss << "enum class ESovereignValidationResult : uint8 {\n";
        oss << "    APPROVED                      UMETA(DisplayName = \"Approved\"),\n";
        oss << "    REJECTED_BOUNDARY_VIOLATION    UMETA(DisplayName = \"Boundary Violation\"),\n";
        oss << "    REJECTED_LIQUIDITY_EXCEEDED    UMETA(DisplayName = \"Liquidity Exceeded\"),\n";
        oss << "    REJECTED_OWNERSHIP_LOCKED      UMETA(DisplayName = \"Ownership Locked\"),\n";
        oss << "    REJECTED_COOLDOWN_ACTIVE       UMETA(DisplayName = \"Cooldown Active\"),\n";
        oss << "    REJECTED_INVALID_TARGET        UMETA(DisplayName = \"Invalid Target\"),\n";
        oss << "    REJECTED_SANITIZATION_FAILED   UMETA(DisplayName = \"Sanitization Failed\"),\n";
        oss << "    REJECTED_INTEGRITY_FAILURE     UMETA(DisplayName = \"Integrity Failure\"),\n";
        oss << "    REJECTED_EMPTY_INTENT          UMETA(DisplayName = \"Empty Intent\"),\n";
        oss << "    REJECTED_MALFORMED_INTENT      UMETA(DisplayName = \"Malformed Intent\")\n";
        oss << "};\n\n";

        oss << "USTRUCT(BlueprintType)\n";
        oss << "struct FSovereignActionStruct {\n";
        oss << "    GENERATED_BODY()\n\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FString ActionTypeName;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) ESovereignIntentCategory Category;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FString SourceEntityHash;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FString TargetEntityHash;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) float AmountCredits;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FVector Position;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) float Intensity;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FString SanitizedIntent;\n";
        oss << "};\n\n";

        oss << "USTRUCT(BlueprintType)\n";
        oss << "struct FSovereignValidationReport {\n";
        oss << "    GENERATED_BODY()\n\n";
        oss << "    UPROPERTY(BlueprintReadOnly) ESovereignValidationResult Result;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FString Reason;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FSovereignActionStruct Action;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) int32 PassesChecked;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) float ValidationTimeMs;\n";
        oss << "};\n\n";

        oss << "UCLASS(BlueprintType)\n";
        oss << "class USovereignSynapse : public UObject {\n";
        oss << "    GENERATED_BODY()\n";
        oss << "public:\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Synapse\")\n";
        oss << "    FSovereignValidationReport ProcessIntent(const FString& RawIntent,\n";
        oss << "        const FString& SourceEntityHash, const FString& TargetEntityHash);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Synapse\")\n";
        oss << "    FSovereignActionStruct SanitizeIntent(const FString& RawIntent);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Synapse\")\n";
        oss << "    void PredictAction(const FString& EntityHash, const FString& ActionName);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Synapse\")\n";
        oss << "    void ConfirmAction(const FString& EntityHash);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Synapse\")\n";
        oss << "    void RollbackAction(const FString& EntityHash, const FString& Reason);\n\n";
        oss << "    UFUNCTION(BlueprintPure, Category = \"Sovereign|Synapse\")\n";
        oss << "    bool IsActionPending(const FString& EntityHash) const;\n";
        oss << "};\n";

        return oss.str();
    }

    std::string exportStatsJSON() const {
        std::lock_guard<std::mutex> lock(statsMutex_);
        std::ostringstream oss;
        oss << "{\"totalIntentsProcessed\":" << stats_.totalIntentsProcessed
            << ",\"totalApproved\":" << stats_.totalApproved
            << ",\"totalRejected\":" << stats_.totalRejected
            << ",\"totalSanitized\":" << stats_.totalSanitized
            << ",\"totalSlopStripped\":" << stats_.totalSlopStripped
            << ",\"totalRollbacks\":" << stats_.totalRollbacks
            << ",\"totalPredictions\":" << stats_.totalPredictions
            << ",\"totalConfirmations\":" << stats_.totalConfirmations
            << ",\"avgValidationTimeMs\":" << std::fixed << std::setprecision(4) << stats_.avgValidationTimeMs
            << "}";
        return oss.str();
    }

private:
    SovereignSynapse() = default;
    SovereignSynapse(const SovereignSynapse&) = delete;
    SovereignSynapse& operator=(const SovereignSynapse&) = delete;

    mutable std::mutex statsMutex_;
    std::mutex cooldownMutex_;
    std::mutex mirrorMutex_;
    FSynapseStats stats_;
    std::unordered_map<std::string, std::chrono::high_resolution_clock::time_point> lastActionTimestamp_;
    std::unordered_map<std::string, FBehavioralMirrorState> mirrorStates_;
    IntentProcessedDelegate intentDelegate_;
    RollbackDelegate rollbackDelegate_;

    void finalizeReport(FValidationReport& report,
                         std::chrono::high_resolution_clock::time_point startTime,
                         const FSynapseConstraints& constraints) {
        auto endTime = std::chrono::high_resolution_clock::now();
        report.validationTimeMs = std::chrono::duration<float, std::milli>(endTime - startTime).count();
        report.updateHash();

        std::lock_guard<std::mutex> lock(statsMutex_);
        stats_.totalValidationTimeMs += report.validationTimeMs;
        int totalValidated = stats_.totalApproved + stats_.totalRejected + 1;
        stats_.avgValidationTimeMs = stats_.totalValidationTimeMs / totalValidated;

        if (report.result == ValidationResult::REJECTED_BOUNDARY_VIOLATION) {
            stats_.totalBoundaryViolations++;
        } else if (report.result == ValidationResult::REJECTED_LIQUIDITY_EXCEEDED) {
            stats_.totalLiquidityExceeded++;
        } else if (report.result == ValidationResult::REJECTED_COOLDOWN_ACTIVE) {
            stats_.totalCooldownBlocked++;
        }
    }

    static std::vector<std::string> tokenize(const std::string& input) {
        std::vector<std::string> tokens;
        std::istringstream iss(input);
        std::string token;
        while (iss >> token) {
            tokens.push_back(token);
        }
        return tokens;
    }

    static std::string toLower(const std::string& s) {
        std::string result = s;
        std::transform(result.begin(), result.end(), result.begin(), ::tolower);
        return result;
    }

    static std::string toUpper(const std::string& s) {
        std::string result = s;
        std::transform(result.begin(), result.end(), result.begin(), ::toupper);
        return result;
    }

    static bool isNumeric(const std::string& s) {
        if (s.empty()) return false;
        bool hasDot = false;
        size_t start = (s[0] == '-' || s[0] == '+') ? 1 : 0;
        if (start >= s.size()) return false;
        for (size_t i = start; i < s.size(); i++) {
            if (s[i] == '.') {
                if (hasDot) return false;
                hasDot = true;
            } else if (!std::isdigit(static_cast<unsigned char>(s[i]))) {
                return false;
            }
        }
        return true;
    }
};

}
