/**
 * SecureMint Engine - GraphQL Schema
 */

export const typeDefs = `#graphql
  scalar BigInt
  scalar DateTime
  scalar Address

  # ═══════════════════════════════════════════════════════════════════════════════
  # TYPES
  # ═══════════════════════════════════════════════════════════════════════════════

  type Token {
    address: Address!
    name: String!
    symbol: String!
    decimals: Int!
    totalSupply: BigInt!
    paused: Boolean!
  }

  type BackingData {
    totalBacking: BigInt!
    backingRatio: Float!
    lastUpdate: DateTime!
    oracleSource: String!
    isStale: Boolean!
  }

  type Treasury {
    tier1Balance: BigInt!
    tier2Balance: BigInt!
    tier3Balance: BigInt!
    tier4Balance: BigInt!
    totalReserves: BigInt!
    utilizationRate: Float!
  }

  type MintRequest {
    id: ID!
    recipient: Address!
    amount: BigInt!
    status: MintStatus!
    transactionHash: String
    createdAt: DateTime!
    processedAt: DateTime
  }

  type BurnRequest {
    id: ID!
    holder: Address!
    amount: BigInt!
    status: BurnStatus!
    transactionHash: String
    createdAt: DateTime!
    processedAt: DateTime
  }

  type RedemptionRequest {
    id: ID!
    holder: Address!
    tokenAmount: BigInt!
    redemptionAsset: Address!
    expectedAmount: BigInt!
    status: RedemptionStatus!
    queuePosition: Int
    transactionHash: String
    createdAt: DateTime!
    processedAt: DateTime
  }

  type BridgeTransfer {
    id: ID!
    sourceChain: Int!
    destinationChain: Int!
    sender: Address!
    recipient: Address!
    amount: BigInt!
    status: BridgeStatus!
    sourceTransactionHash: String
    destinationTransactionHash: String
    createdAt: DateTime!
    completedAt: DateTime
  }

  type ComplianceResult {
    address: Address!
    isCompliant: Boolean!
    kycStatus: KYCStatus!
    amlRiskScore: Float!
    sanctionsMatch: Boolean!
    checkedAt: DateTime!
    reasons: [String!]
  }

  type InvariantStatus {
    id: String!
    name: String!
    passed: Boolean!
    currentValue: String!
    threshold: String!
    lastChecked: DateTime!
  }

  type EmergencyState {
    currentLevel: Int!
    levelName: String!
    activeSince: DateTime
    triggeredBy: Address
    restrictions: [String!]!
  }

  type OracleStatus {
    address: Address!
    isActive: Boolean!
    lastUpdate: DateTime!
    stalenessThreshold: Int!
    currentRoundId: BigInt!
  }

  type Statistics {
    totalMinted: BigInt!
    totalBurned: BigInt!
    totalRedeemed: BigInt!
    totalBridged: BigInt!
    uniqueHolders: Int!
    dailyVolume: BigInt!
    weeklyVolume: BigInt!
    monthlyVolume: BigInt!
  }

  type GasEstimate {
    operation: String!
    estimatedGas: BigInt!
    gasPrice: BigInt!
    maxFeePerGas: BigInt!
    maxPriorityFeePerGas: BigInt!
    estimatedCostWei: BigInt!
    estimatedCostUSD: Float!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # ENUMS
  # ═══════════════════════════════════════════════════════════════════════════════

  enum MintStatus {
    PENDING
    SIMULATING
    SUBMITTED
    CONFIRMED
    FAILED
    REJECTED
  }

  enum BurnStatus {
    PENDING
    SIMULATING
    SUBMITTED
    CONFIRMED
    FAILED
  }

  enum RedemptionStatus {
    QUEUED
    PROCESSING
    COMPLETED
    CANCELLED
    FAILED
  }

  enum BridgeStatus {
    INITIATED
    SOURCE_CONFIRMED
    VALIDATORS_SIGNED
    DESTINATION_PENDING
    COMPLETED
    FAILED
  }

  enum KYCStatus {
    NOT_VERIFIED
    PENDING
    VERIFIED
    REJECTED
    EXPIRED
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # INPUTS
  # ═══════════════════════════════════════════════════════════════════════════════

  input MintInput {
    recipient: Address!
    amount: BigInt!
    simulate: Boolean
  }

  input BurnInput {
    amount: BigInt!
    simulate: Boolean
  }

  input RedemptionInput {
    amount: BigInt!
    redemptionAsset: Address!
  }

  input BridgeInput {
    destinationChain: Int!
    recipient: Address!
    amount: BigInt!
  }

  input ComplianceCheckInput {
    addresses: [Address!]!
    checkKYC: Boolean
    checkAML: Boolean
    checkSanctions: Boolean
  }

  input PaginationInput {
    limit: Int
    offset: Int
    orderBy: String
    orderDirection: OrderDirection
  }

  enum OrderDirection {
    ASC
    DESC
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # QUERIES
  # ═══════════════════════════════════════════════════════════════════════════════

  type Query {
    # Token queries
    token: Token!
    backing: BackingData!
    treasury: Treasury!
    statistics: Statistics!

    # Status queries
    invariants: [InvariantStatus!]!
    emergencyState: EmergencyState!
    oracleStatus: OracleStatus!

    # Request queries
    mintRequest(id: ID!): MintRequest
    mintRequests(pagination: PaginationInput): [MintRequest!]!
    burnRequest(id: ID!): BurnRequest
    burnRequests(pagination: PaginationInput): [BurnRequest!]!
    redemptionRequest(id: ID!): RedemptionRequest
    redemptionQueue(pagination: PaginationInput): [RedemptionRequest!]!

    # Bridge queries
    bridgeTransfer(id: ID!): BridgeTransfer
    bridgeTransfers(
      sourceChain: Int
      destinationChain: Int
      pagination: PaginationInput
    ): [BridgeTransfer!]!

    # Compliance queries
    complianceStatus(address: Address!): ComplianceResult

    # Gas estimation
    estimateGas(operation: String!, params: String): GasEstimate!

    # Account queries
    balance(address: Address!): BigInt!
    allowance(owner: Address!, spender: Address!): BigInt!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # MUTATIONS
  # ═══════════════════════════════════════════════════════════════════════════════

  type Mutation {
    # Mint operations
    simulateMint(input: MintInput!): MintRequest!
    executeMint(id: ID!): MintRequest!

    # Burn operations
    simulateBurn(input: BurnInput!): BurnRequest!
    executeBurn(id: ID!): BurnRequest!

    # Redemption operations
    requestRedemption(input: RedemptionInput!): RedemptionRequest!
    cancelRedemption(id: ID!): RedemptionRequest!

    # Bridge operations
    initiateBridge(input: BridgeInput!): BridgeTransfer!

    # Compliance operations
    checkCompliance(input: ComplianceCheckInput!): [ComplianceResult!]!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # SUBSCRIPTIONS
  # ═══════════════════════════════════════════════════════════════════════════════

  type Subscription {
    # Real-time updates
    backingUpdated: BackingData!
    mintProcessed: MintRequest!
    burnProcessed: BurnRequest!
    redemptionProcessed: RedemptionRequest!
    bridgeStatusChanged: BridgeTransfer!
    emergencyLevelChanged: EmergencyState!
    invariantViolation: InvariantStatus!
  }
`;
