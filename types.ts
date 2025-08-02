import { Type } from "@google/genai";

export type Language = 'es' | 'en';

export type AppView = 'creative_analysis' | 'performance' | 'strategies' | 'reports' | 'clients' | 'import' | 'users' | 'logs' | 'control_panel' | 'help' | 'settings';

export enum Severity {
    CRITICAL = 'CRITICAL',
    RECOMMENDED = 'RECOMMENDED',
    GOOD_TO_KNOW = 'GOOD_TO_KNOW',
}

export interface RecommendationItem {
    headline: string;
    points: string[];
}

export interface AdvantagePlusRecommendation {
    enhancement: string;
    applicable: 'ACTIVATE' | 'CAUTION';
    justification: string;
}

export interface PlacementSpecificSummary {
    placementId: string;
    summary: string[];
}

export type ChecklistItemSeverity = 'CRITICAL' | 'ACTIONABLE' | 'POSITIVE';

export interface ChecklistItem {
    severity: ChecklistItemSeverity;
    text: string;
}

export interface OverallConclusion {
    headline: string;
    checklist: ChecklistItem[];
}

export interface AnalysisResult {
    creativeDescription: string;
    effectivenessScore: number;
    effectivenessJustification: string;
    clarityScore: number;
    clarityJustification: string;
    textToImageRatio: number;
    textToImageRatioJustification: string;
    funnelStage: 'TOFU' | 'MOFU' | 'BOFU' | 'Error' | 'N/A';
    funnelStageJustification: string;
    recommendations: RecommendationItem[];
    advantagePlusAnalysis: AdvantagePlusRecommendation[];
    placementSummaries: PlacementSpecificSummary[];
    overallConclusion: OverallConclusion;
}

export enum PlacementId {
    FB_FEED,
    FB_VIDEO_FEED,
    FB_STORIES,
    FB_MARKETPLACE,
    FB_REELS,
    IG_FEED,
    IG_STORIES,
    IG_REELS,
    IG_EXPLORE,
    MESSENGER_INBOX,
    MESSENGER_STORIES,
    AUDIENCE_NETWORK,
    MASTER_VIEW,
}

export type UiType = 'FEED' | 'STORIES' | 'REELS' | 'MARKETPLACE' | 'MESSENGER_INBOX' | 'GENERIC';
export type FormatGroup = 'SQUARE_LIKE' | 'VERTICAL';


export interface Placement {
    id: PlacementId;
    platform: 'Facebook' | 'Instagram' | 'Messenger' | 'Audience Network';
    name: string;
    uiType: UiType;
    group: FormatGroup;
    aspectRatios: string[];
    recommendedResolution: string;
    safeZone: {
        top: string;
        bottom: string;
        left?: string;
        right?: string;
    };
}

export interface Creative {
    file: File;
    url: string;
    type: 'image' | 'video';
    width: number;
    height: number;
    format: 'square' | 'vertical';
    hash: string;
}

export type CreativeSet = {
    square: Creative | null;
    vertical: Creative | null;
    videoFile?: File | null;
};

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface Client {
  id: string;
  name: string;
  logo: string;
  currency: string;
  userId: string;
  metaAccountName?: string;
}

export interface PerformanceRecord {
  clientId: string;
  uniqueId: string; // Composite key: day + campaignName + adName + age + gender
  campaignName: string;
  adSetName: string;
  adName: string;
  day: string;
  age: string;
  gender: string;
  spend: number;
  campaignDelivery: string;
  adSetDelivery: string;
  adDelivery: string;
  impressions: number;
  reach: number;
  frequency: number;
  purchases: number;
  landingPageViews: number;
  clicksAll: number;
  cpm: number;
  ctrAll: number;
  cpcAll: number;
  videoPlays3s: number;
  checkoutsInitiated: number;
  pageLikes: number;
  addsToCart: number;
  checkoutsInitiatedOnWebsite: number;
  campaignBudget: string;
  campaignBudgetType: string;
  includedCustomAudiences: string;
  excludedCustomAudiences: string;
  linkClicks: number;
  paymentInfoAdds: number;
  pageEngagement: number;
  postComments: number;
  postInteractions: number;
  postReactions: number;
  postShares: number;
  bid: string;
  bidType: string;
  websiteUrl: string;
  ctrLink: number;
  currency: string;
  purchaseValue: number;
  objective: string;
  purchaseType: string;
  reportStart: string;
  reportEnd: string;
  attention: number;
  desire: number;
  interest: number;
  videoPlays25percent: number;
  videoPlays50percent: number;
  videoPlays75percent: number;
  videoPlays95percent: number;
  videoPlays100percent: number;
  videoPlayRate3s: number;
  aov: number;
  lpViewRate: number;
  adcToLpv: number;
  videoCapture: string;
  landingConversionRate: number;
  percentPurchases: number;
  visualizations: number;
  cvrLinkClick: number;
  videoRetentionProprietary: number;
  videoRetentionMeta: number;
  videoAveragePlayTime: number;
  thruPlays: number;
  videoPlays: number;
  videoPlays2sContinuousUnique: number;
  ctrUniqueLink: number;
  accountName: string;
  impressionsPerPurchase: number;
  videoFileName?: string;
  imageName?: string;
  creativeIdentifier?: string;
  purchaseRateFromLandingPageViews?: number;
}


export interface AccountAverages {
    roas: number;
    cpa: number;
    ctrLink: number;
    cpm: number;
    frequency: number;
    tasaCompra: number;
}

export interface DemographicData {
    ageRange: string;
    gender: string;
    spend: number;
    purchases: number;
    purchaseValue: number;
    linkClicks: number;
    impressions: number;
}

export interface AdEvolutionMetrics {
    roas: number;
    cpa: number;
    ctrLink: number;
    tasaCompra: number;
    spend: number;
    purchases: number;
    cpm: number;
    frequency: number;
}

export interface AggregatedAdPerformance {
    adName: string;
    adSetNames: string[];
    campaignNames: string[];
    includedCustomAudiences: string[];
    excludedCustomAudiences: string[];
    spend: number;
    purchases: number;
    purchaseValue: number;
    impressions: number;
    clicks: number; // Clicks (All)
    linkClicks: number;
    roas: number;
    cpa: number;
    cpm: number;
    ctr: number; // CTR (All)
    ctrLink: number;
    frequency: number;
    videoAveragePlayTime: number;
    thruPlays: number;
    isMatched: boolean;
    creativeDescription?: string;
    currency: string;
    inMultipleAdSets: boolean;
    imageUrl?: string;
    adPreviewLink?: string;
    creativeType?: 'image' | 'video';
    analysisResult?: AnalysisResult;
    videoFileName?: string;
    isVideoUploaded?: boolean;
    ticketPromedio: number;
    alcance: number;
    cpc: number;
    visitasLP: number;
    tasaVisitaLP: number;
    tasaCompra: number;
    addsToCart: number;
    checkoutsInitiated: number;
    postInteractions: number;
    postReactions: number;
    postComments: number;
    postShares: number;
    pageLikes: number;
    activeDays: number;
    atencion: number;
    interes: number;
    deseo: number;
    demographics?: DemographicData[];
    previousWeekMetrics?: AdEvolutionMetrics;
}

// Data from Looker Studio Report
export interface LookerCreativeData {
    imageUrl: string;
    adPreviewLink?: string;
    creativeDescription?: string;
    analysisResult?: AnalysisResult;
}

export interface ClientLookerData {
    [adName: string]: LookerCreativeData;
}

export interface AllLookerData {
    [clientId: string]: ClientLookerData;
}

export interface TrendMetric {
  metricName: string;
  value: string;
}

export interface TrendCardData {
  title: string;
  explanation: string;
  supportingMetrics: TrendMetric[];
  recommendation: string;
  demographicInsights?: string;
  fatigueAnalysis?: string;
}

export interface TrendsAnalysisResult {
    trends: TrendCardData[];
}

export interface ReportMetadata {
  reportType: string;
  date: string;
  currency: string;
  campaignFilter: string;
  adSetFilter: string;
}

export interface ParsedMetricValue {
  value: number;
  change?: number; 
  direction?: 'up' | 'down' | 'neutral';
  symbol?: string;
}

export type ReportRow = {
  [header: string]: string | ParsedMetricValue;
};

export interface ReportTable {
  title: string;
  headers: string[];
  rows: ReportRow[];
}

export interface BitacoraReport {
  id: string; // uuid
  clientId: string;
  fileName: string;
  importDate: string;
  metadata: ReportMetadata;
  mainSummaryTable?: ReportTable;
  funnelAnalysisTable?: ReportTable;
  topAdsTables: ReportTable[];
  topAdSetsTables: ReportTable[];
  topCampaignsTables: ReportTable[];
  audiencePerformanceTable?: ReportTable;
  ratioTrendsTable?: ReportTable;
}

export interface WeeklyReportSummary {
  weekId: string;
  reportId: string;
  periodLabel: string;
  metrics: {
    roas?: ParsedMetricValue | string;
    inversion?: ParsedMetricValue | string;
    ventas?: ParsedMetricValue | string;
    cpa?: ParsedMetricValue | string;
  };
  importDate: string;
}

export interface MonthlyReportSummary {
  monthId: string; // e.g., "2025-07"
  periodLabel: string; // e.g., "Julio 2025"
  metrics: {
      roas: number;
      inversion: number;
      ventas: number;
      cpa: number;
  };
  previousMetrics?: {
      roas: number;
      inversion: number;
      ventas: number;
      cpa: number;
  };
}

export interface UploadedVideo {
    id: string; // Composite key: clientId_adName
    clientId: string;
    adName: string;
    videoFileName: string;
    dataUrl: string;
}

export type ImportSource = 'looker' | 'meta' | 'txt' | 'api';
export interface ImportBatch {
    id: string;
    timestamp: string;
    source: ImportSource;
    fileName: string;
    fileHash: string;
    clientName: string;
    description: string;
    undoData: {
        type: ImportSource;
        keys: string[];
        clientId: string;
    }
}

export interface ProcessedHashes {
    [clientId: string]: string[];
}

export interface MetaApiConfig {
    appId: string;
    appSecret: string;
    accessToken: string;
}

export type ProcessResult = { 
    client: Client; 
    records: PerformanceRecord[]; 
    undoKeys: string[]; 
    newRecordsCount: number;
    periodStart?: string;
    periodEnd?: string;
    daysDetected?: number;
};

export type LookerProcessResult = {
    client: Client;
    lookerDataPatch: ClientLookerData;
    undoKeys: string[];
    newRecordsCount: number;
};