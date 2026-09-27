export const kinds = ['product','capability','behavior','scenario','quality','policy','decision','component','realization','verification','evidence','contract'] as const;
export type Kind = typeof kinds[number];
export const connectionTypes = ['depends_on','calls','publishes','subscribes','reads','writes','routes_to'] as const;
export type ConnectionType = typeof connectionTypes[number];
export type TraceRelation = 'has' | 'realizedBy' | 'implementedBy' | 'verifiedBy' | 'appliesTo' | 'affects' | 'evidencedBy' | 'uses' | 'provides' | 'consumes';
export type Relation = TraceRelation | ConnectionType;
export interface Entity { id: string; kind: Kind; name: string; path: string; data: Record<string, unknown> }
export interface Edge { from: string; to: string; relation: Relation; id?: string; protocol?: string; contract?: string; label?: string }
export interface ArchitectureConnection {id:string; from:string; to:string; type:ConnectionType; protocol?:string; contract?:string; label?:string; description?:string; extensions?:Record<string,unknown>}
export interface Diagnostic { code: string; severity: 'error'|'warning'; path: string; message: string; entityId?: string; field?: string }
export interface Model { version: '0.1'; entities: Entity[]; edges: Edge[]; connections: ArchitectureConnection[]; diagnostics: Diagnostic[]; source: Record<string, unknown> }
export interface Question { id: string; entityId?: string; field?: string; priority: number; text: string; reason: string }
export interface TraversalOptions { depth?: number; relationTypes?: readonly Relation[]; direction?: 'both'|'forward'|'reverse' }
export interface VerificationSummary { coverage:'uncovered'|'covered'; verification_status:'unknown'|'passed'|'failed'; status:'uncovered'|'covered_unknown'|'verified'|'failed'; verificationIds:string[] }

export type ConversationPhase = 'landscape' | 'shape' | 'depth' | 'realization' | 'assurance';
export interface ConversationContext {
 phase?: ConversationPhase;
 focusIds?: string[];
 recentQuestionTypes?: string[];
 userRequestedDepth?: 'overview' | 'normal' | 'deep';
 locale?: string;
}
export interface DesignQuestion {
 code: string;
 targetId?: string;
 concept: Kind;
 message: string;
 priority: number;
 score: number;
 phase: ConversationPhase;
 strategy: 'ask' | 'infer' | 'suggest' | 'defer';
}
export interface QuestionPlan {
 phase: ConversationPhase;
 primary: DesignQuestion | null;
 related: DesignQuestion[];
 deferred: DesignQuestion[];
 rationaleCodes: string[];
}
