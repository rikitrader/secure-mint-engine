/**
 * SecureMint Engine - Jurisdiction-Specific Compliance Configurations
 * Region-specific compliance rules and requirements
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type JurisdictionCode =
  | 'US' | 'US-NY' | 'US-CA' | 'US-TX' | 'US-FL'
  | 'EU' | 'EU-DE' | 'EU-FR' | 'EU-IE'
  | 'UK' | 'CH' | 'SG' | 'HK' | 'JP' | 'KR' | 'AU'
  | 'AE' | 'BH' | 'CAYMAN' | 'BVI';

export type LicenseType =
  | 'MTL' // Money Transmitter License
  | 'EMI' // E-Money Institution
  | 'PSP' // Payment Service Provider
  | 'VFA' // Virtual Financial Asset
  | 'VASP' // Virtual Asset Service Provider
  | 'MPI' // Major Payment Institution
  | 'NONE';

export interface JurisdictionConfig {
  code: JurisdictionCode;
  name: string;
  region: 'Americas' | 'Europe' | 'Asia-Pacific' | 'Middle East';

  // Licensing
  requiredLicenses: LicenseType[];
  licensingAuthority: string;

  // KYC Requirements
  kyc: {
    required: boolean;
    minLevel: 'basic' | 'enhanced' | 'institutional';
    documentTypes: string[];
    verificationFrequency: number; // days
    pepScreening: boolean;
    sanctionsScreening: boolean;
  };

  // AML Requirements
  aml: {
    transactionMonitoring: boolean;
    suspiciousActivityReporting: boolean;
    reportingThreshold: number; // in USD
    currencyTransactionReporting: boolean;
    ctrThreshold: number; // in USD
    travelRuleThreshold: number; // in USD
    recordRetentionYears: number;
  };

  // Operational Limits
  limits: {
    maxTransactionSize: number | null;
    dailyLimit: number | null;
    monthlyLimit: number | null;
    annualLimit: number | null;
    accreditedInvestorRequired: boolean;
    minimumInvestment: number | null;
  };

  // Reporting
  reporting: {
    regulatoryReports: string[];
    reportingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
    auditRequired: boolean;
    auditFrequency: 'annual' | 'semi-annual' | 'quarterly';
  };

  // Restrictions
  restrictions: {
    retailAllowed: boolean;
    institutionalOnly: boolean;
    accreditedOnly: boolean;
    geoblockRequired: boolean;
    vpnBlockRequired: boolean;
    bannedActivities: string[];
  };

  // Tax
  tax: {
    vatApplicable: boolean;
    vatRate: number;
    withholdingTax: boolean;
    withholdingRate: number;
    reportingRequired: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// JURISDICTION CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const JURISDICTION_CONFIGS: Record<JurisdictionCode, JurisdictionConfig> = {
  // United States (Federal)
  'US': {
    code: 'US',
    name: 'United States',
    region: 'Americas',
    requiredLicenses: ['MTL'],
    licensingAuthority: 'FinCEN / State Regulators',
    kyc: {
      required: true,
      minLevel: 'enhanced',
      documentTypes: ['passport', 'drivers_license', 'state_id', 'ssn'],
      verificationFrequency: 365,
      pepScreening: true,
      sanctionsScreening: true,
    },
    aml: {
      transactionMonitoring: true,
      suspiciousActivityReporting: true,
      reportingThreshold: 5000,
      currencyTransactionReporting: true,
      ctrThreshold: 10000,
      travelRuleThreshold: 3000,
      recordRetentionYears: 5,
    },
    limits: {
      maxTransactionSize: null,
      dailyLimit: null,
      monthlyLimit: null,
      annualLimit: null,
      accreditedInvestorRequired: false,
      minimumInvestment: null,
    },
    reporting: {
      regulatoryReports: ['SAR', 'CTR', 'FBAR'],
      reportingFrequency: 'quarterly',
      auditRequired: true,
      auditFrequency: 'annual',
    },
    restrictions: {
      retailAllowed: true,
      institutionalOnly: false,
      accreditedOnly: false,
      geoblockRequired: false,
      vpnBlockRequired: false,
      bannedActivities: ['gambling', 'adult_content'],
    },
    tax: {
      vatApplicable: false,
      vatRate: 0,
      withholdingTax: true,
      withholdingRate: 30,
      reportingRequired: true,
    },
  },

  // New York (BitLicense)
  'US-NY': {
    code: 'US-NY',
    name: 'New York',
    region: 'Americas',
    requiredLicenses: ['MTL'],
    licensingAuthority: 'NYDFS (BitLicense)',
    kyc: {
      required: true,
      minLevel: 'enhanced',
      documentTypes: ['passport', 'drivers_license', 'state_id', 'ssn'],
      verificationFrequency: 180,
      pepScreening: true,
      sanctionsScreening: true,
    },
    aml: {
      transactionMonitoring: true,
      suspiciousActivityReporting: true,
      reportingThreshold: 3000,
      currencyTransactionReporting: true,
      ctrThreshold: 10000,
      travelRuleThreshold: 3000,
      recordRetentionYears: 7,
    },
    limits: {
      maxTransactionSize: null,
      dailyLimit: null,
      monthlyLimit: null,
      annualLimit: null,
      accreditedInvestorRequired: false,
      minimumInvestment: null,
    },
    reporting: {
      regulatoryReports: ['SAR', 'CTR', 'NYDFS_QUARTERLY'],
      reportingFrequency: 'quarterly',
      auditRequired: true,
      auditFrequency: 'annual',
    },
    restrictions: {
      retailAllowed: true,
      institutionalOnly: false,
      accreditedOnly: false,
      geoblockRequired: false,
      vpnBlockRequired: false,
      bannedActivities: ['gambling', 'adult_content', 'privacy_coins'],
    },
    tax: {
      vatApplicable: false,
      vatRate: 0,
      withholdingTax: true,
      withholdingRate: 30,
      reportingRequired: true,
    },
  },

  // European Union (MiCA)
  'EU': {
    code: 'EU',
    name: 'European Union',
    region: 'Europe',
    requiredLicenses: ['EMI', 'VASP'],
    licensingAuthority: 'National Competent Authority (MiCA)',
    kyc: {
      required: true,
      minLevel: 'enhanced',
      documentTypes: ['passport', 'national_id', 'residence_permit'],
      verificationFrequency: 365,
      pepScreening: true,
      sanctionsScreening: true,
    },
    aml: {
      transactionMonitoring: true,
      suspiciousActivityReporting: true,
      reportingThreshold: 1000,
      currencyTransactionReporting: false,
      ctrThreshold: 0,
      travelRuleThreshold: 1000,
      recordRetentionYears: 5,
    },
    limits: {
      maxTransactionSize: null,
      dailyLimit: null,
      monthlyLimit: null,
      annualLimit: null,
      accreditedInvestorRequired: false,
      minimumInvestment: null,
    },
    reporting: {
      regulatoryReports: ['STR', 'MiCA_QUARTERLY', 'WHITEPAPER'],
      reportingFrequency: 'quarterly',
      auditRequired: true,
      auditFrequency: 'annual',
    },
    restrictions: {
      retailAllowed: true,
      institutionalOnly: false,
      accreditedOnly: false,
      geoblockRequired: false,
      vpnBlockRequired: false,
      bannedActivities: ['gambling'],
    },
    tax: {
      vatApplicable: false, // Crypto exempt from VAT
      vatRate: 0,
      withholdingTax: false,
      withholdingRate: 0,
      reportingRequired: true,
    },
  },

  // United Kingdom (FCA)
  'UK': {
    code: 'UK',
    name: 'United Kingdom',
    region: 'Europe',
    requiredLicenses: ['EMI', 'VASP'],
    licensingAuthority: 'FCA',
    kyc: {
      required: true,
      minLevel: 'enhanced',
      documentTypes: ['passport', 'driving_licence', 'utility_bill'],
      verificationFrequency: 365,
      pepScreening: true,
      sanctionsScreening: true,
    },
    aml: {
      transactionMonitoring: true,
      suspiciousActivityReporting: true,
      reportingThreshold: 0,
      currencyTransactionReporting: false,
      ctrThreshold: 0,
      travelRuleThreshold: 1000,
      recordRetentionYears: 5,
    },
    limits: {
      maxTransactionSize: null,
      dailyLimit: null,
      monthlyLimit: null,
      annualLimit: null,
      accreditedInvestorRequired: false,
      minimumInvestment: null,
    },
    reporting: {
      regulatoryReports: ['SAR', 'FCA_QUARTERLY'],
      reportingFrequency: 'quarterly',
      auditRequired: true,
      auditFrequency: 'annual',
    },
    restrictions: {
      retailAllowed: true,
      institutionalOnly: false,
      accreditedOnly: false,
      geoblockRequired: false,
      vpnBlockRequired: false,
      bannedActivities: ['gambling'],
    },
    tax: {
      vatApplicable: false,
      vatRate: 0,
      withholdingTax: false,
      withholdingRate: 0,
      reportingRequired: true,
    },
  },

  // Singapore (MAS)
  'SG': {
    code: 'SG',
    name: 'Singapore',
    region: 'Asia-Pacific',
    requiredLicenses: ['MPI', 'PSP'],
    licensingAuthority: 'MAS',
    kyc: {
      required: true,
      minLevel: 'enhanced',
      documentTypes: ['passport', 'nric', 'employment_pass'],
      verificationFrequency: 365,
      pepScreening: true,
      sanctionsScreening: true,
    },
    aml: {
      transactionMonitoring: true,
      suspiciousActivityReporting: true,
      reportingThreshold: 20000,
      currencyTransactionReporting: true,
      ctrThreshold: 20000,
      travelRuleThreshold: 1500,
      recordRetentionYears: 5,
    },
    limits: {
      maxTransactionSize: null,
      dailyLimit: null,
      monthlyLimit: null,
      annualLimit: null,
      accreditedInvestorRequired: false,
      minimumInvestment: null,
    },
    reporting: {
      regulatoryReports: ['STR', 'CTR', 'MAS_QUARTERLY'],
      reportingFrequency: 'quarterly',
      auditRequired: true,
      auditFrequency: 'annual',
    },
    restrictions: {
      retailAllowed: true,
      institutionalOnly: false,
      accreditedOnly: false,
      geoblockRequired: false,
      vpnBlockRequired: false,
      bannedActivities: ['gambling'],
    },
    tax: {
      vatApplicable: true,
      vatRate: 8,
      withholdingTax: false,
      withholdingRate: 0,
      reportingRequired: true,
    },
  },

  // Cayman Islands
  'CAYMAN': {
    code: 'CAYMAN',
    name: 'Cayman Islands',
    region: 'Americas',
    requiredLicenses: ['VASP'],
    licensingAuthority: 'CIMA',
    kyc: {
      required: true,
      minLevel: 'basic',
      documentTypes: ['passport', 'utility_bill'],
      verificationFrequency: 365,
      pepScreening: true,
      sanctionsScreening: true,
    },
    aml: {
      transactionMonitoring: true,
      suspiciousActivityReporting: true,
      reportingThreshold: 15000,
      currencyTransactionReporting: false,
      ctrThreshold: 0,
      travelRuleThreshold: 1000,
      recordRetentionYears: 5,
    },
    limits: {
      maxTransactionSize: null,
      dailyLimit: null,
      monthlyLimit: null,
      annualLimit: null,
      accreditedInvestorRequired: false,
      minimumInvestment: null,
    },
    reporting: {
      regulatoryReports: ['STR', 'CIMA_ANNUAL'],
      reportingFrequency: 'annual',
      auditRequired: true,
      auditFrequency: 'annual',
    },
    restrictions: {
      retailAllowed: true,
      institutionalOnly: false,
      accreditedOnly: false,
      geoblockRequired: false,
      vpnBlockRequired: false,
      bannedActivities: [],
    },
    tax: {
      vatApplicable: false,
      vatRate: 0,
      withholdingTax: false,
      withholdingRate: 0,
      reportingRequired: false,
    },
  },

  // Add more jurisdictions as needed...
  'US-CA': {} as JurisdictionConfig,
  'US-TX': {} as JurisdictionConfig,
  'US-FL': {} as JurisdictionConfig,
  'EU-DE': {} as JurisdictionConfig,
  'EU-FR': {} as JurisdictionConfig,
  'EU-IE': {} as JurisdictionConfig,
  'CH': {} as JurisdictionConfig,
  'HK': {} as JurisdictionConfig,
  'JP': {} as JurisdictionConfig,
  'KR': {} as JurisdictionConfig,
  'AU': {} as JurisdictionConfig,
  'AE': {} as JurisdictionConfig,
  'BH': {} as JurisdictionConfig,
  'BVI': {} as JurisdictionConfig,
};

// ═══════════════════════════════════════════════════════════════════════════════
// JURISDICTION MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class JurisdictionManager {
  private configs: Map<JurisdictionCode, JurisdictionConfig> = new Map();

  constructor() {
    // Load default configs
    Object.entries(JURISDICTION_CONFIGS).forEach(([code, config]) => {
      if (config.code) {
        this.configs.set(code as JurisdictionCode, config);
      }
    });
  }

  getConfig(code: JurisdictionCode): JurisdictionConfig | undefined {
    return this.configs.get(code);
  }

  getAllConfigs(): JurisdictionConfig[] {
    return Array.from(this.configs.values());
  }

  getByRegion(region: JurisdictionConfig['region']): JurisdictionConfig[] {
    return this.getAllConfigs().filter((c) => c.region === region);
  }

  checkCompliance(
    code: JurisdictionCode,
    operation: {
      type: 'mint' | 'redeem' | 'transfer';
      amount: number;
      userKYCLevel?: string;
      isAccredited?: boolean;
      isInstitutional?: boolean;
    }
  ): {
    allowed: boolean;
    reasons: string[];
    requirements: string[];
  } {
    const config = this.getConfig(code);
    if (!config) {
      return {
        allowed: false,
        reasons: [`Jurisdiction ${code} not supported`],
        requirements: [],
      };
    }

    const reasons: string[] = [];
    const requirements: string[] = [];

    // Check institutional requirement
    if (config.restrictions.institutionalOnly && !operation.isInstitutional) {
      reasons.push('Institutional investors only');
    }

    // Check accredited requirement
    if (config.restrictions.accreditedOnly && !operation.isAccredited) {
      reasons.push('Accredited investors only');
    }

    // Check retail restriction
    if (!config.restrictions.retailAllowed && !operation.isInstitutional) {
      reasons.push('Retail not allowed');
    }

    // Check KYC level
    const kycLevels = ['basic', 'enhanced', 'institutional'];
    const userLevel = kycLevels.indexOf(operation.userKYCLevel || 'none');
    const requiredLevel = kycLevels.indexOf(config.kyc.minLevel);
    if (userLevel < requiredLevel) {
      reasons.push(`KYC level ${config.kyc.minLevel} required`);
      requirements.push(`Complete ${config.kyc.minLevel} KYC verification`);
    }

    // Check limits
    if (config.limits.maxTransactionSize && operation.amount > config.limits.maxTransactionSize) {
      reasons.push(`Transaction exceeds maximum of ${config.limits.maxTransactionSize}`);
    }

    if (config.limits.minimumInvestment && operation.amount < config.limits.minimumInvestment) {
      reasons.push(`Amount below minimum of ${config.limits.minimumInvestment}`);
    }

    return {
      allowed: reasons.length === 0,
      reasons,
      requirements,
    };
  }
}

export default JurisdictionManager;
