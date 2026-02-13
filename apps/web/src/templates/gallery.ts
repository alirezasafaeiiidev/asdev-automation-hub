import { ActorContext } from '../types.js';
import { ControlPlaneService } from '../service.js';

export type WorkflowTemplate = {
  id: string;
  name: string;
  category: 'SERVICE' | 'SOCIAL_COMMERCE' | 'B2B';
  description: string;
  dslJson: unknown;
};

export type TemplateConnectionRequirement = {
  connector: string;
  connectionId: string;
};

const templates: WorkflowTemplate[] = [
  {
    id: 'service-booking-reminder',
    name: 'Service Booking + Reminder',
    category: 'SERVICE',
    description: 'Booking case creation + payment intent + reminder SMS.',
    dslJson: {
      name: 'Booking Reminder',
      trigger: { type: 'core.form.submit', config: { formId: 'booking_form_1' } },
      steps: [
        { id: 's1', connector: 'core.case', operation: 'create', input: { type: 'BOOKING', data: '{{trigger}}' } },
        {
          id: 's2',
          connector: 'ir.payment',
          operation: 'createInvoice',
          connectionId: 'conn_payment',
          input: { amount: '{{trigger.depositAmount}}', meta: { caseId: '{{s1.output.id}}' } },
          policy: { timeoutMs: 10_000, maxAttempts: 3, backoffMs: 300 },
        },
        {
          id: 's3',
          connector: 'ir.sms',
          operation: 'send',
          connectionId: 'conn_sms',
          input: { to: '{{trigger.phone}}', message: 'لینک پرداخت: {{s2.output.payUrl}}' },
        },
      ],
    },
  },
  {
    id: 'social-order-invoice-followup',
    name: 'Social Order + Invoice + Follow-up',
    category: 'SOCIAL_COMMERCE',
    description: 'Create order case, generate invoice, and notify buyer with payment URL.',
    dslJson: {
      name: 'Order Invoice Followup',
      trigger: { type: 'core.form.submit', config: { formId: 'order_form_1' } },
      steps: [
        { id: 's1', connector: 'core.case', operation: 'create', input: { type: 'ORDER', data: '{{trigger}}' } },
        {
          id: 's2',
          connector: 'ir.payment',
          operation: 'createInvoice',
          connectionId: 'conn_payment',
          input: { amount: '{{trigger.amount}}', meta: { caseId: '{{s1.output.id}}' } },
          policy: { timeoutMs: 10_000, maxAttempts: 3, backoffMs: 300 },
        },
        {
          id: 's3',
          connector: 'ir.sms',
          operation: 'send',
          connectionId: 'conn_sms',
          input: { to: '{{trigger.phone}}', message: 'سفارش شما ثبت شد: {{s2.output.payUrl}}' },
        },
      ],
    },
  },
  {
    id: 'b2b-invoice-reminder',
    name: 'B2B Invoice + Due Reminder',
    category: 'B2B',
    description: 'Issue B2B invoice and send payment reminder.',
    dslJson: {
      name: 'B2B Invoice Reminder',
      trigger: { type: 'core.form.submit', config: { formId: 'b2b_invoice_1' } },
      steps: [
        {
          id: 's1',
          connector: 'core.case',
          operation: 'create',
          input: { type: 'B2B_INVOICE', data: '{{trigger}}' },
        },
        {
          id: 's2',
          connector: 'ir.payment',
          operation: 'createInvoice',
          connectionId: 'conn_payment',
          input: { amount: '{{trigger.amount}}', meta: { caseId: '{{s1.output.id}}' } },
          policy: { timeoutMs: 10_000, maxAttempts: 3, backoffMs: 300 },
        },
        {
          id: 's3',
          connector: 'ir.sms',
          operation: 'send',
          connectionId: 'conn_sms',
          input: { to: '{{trigger.financePhone}}', message: 'فاکتور آماده است: {{s2.output.payUrl}}' },
        },
      ],
    },
  },
];

export function listTemplates(): WorkflowTemplate[] {
  return templates;
}

export function getTemplate(templateId: string): WorkflowTemplate | null {
  return templates.find((item) => item.id === templateId) ?? null;
}

export function getTemplateConnectionRequirements(templateId: string): TemplateConnectionRequirement[] {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }
  const dsl = template.dslJson as { steps?: Array<Record<string, unknown>> };
  const seen = new Set<string>();
  const requirements: TemplateConnectionRequirement[] = [];
  for (const step of dsl.steps ?? []) {
    const connector = step.connector;
    const connectionId = step.connectionId;
    if (typeof connector !== 'string' || typeof connectionId !== 'string') {
      continue;
    }
    const key = `${connector}:${connectionId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    requirements.push({ connector, connectionId });
  }
  return requirements;
}

export async function getTemplatePreflight(service: ControlPlaneService, actor: ActorContext, templateId: string) {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }
  const requirements = getTemplateConnectionRequirements(templateId);
  const availableConnections = await service.listConnections(actor);
  const availableProviders = new Set(availableConnections.map((connection) => connection.provider));
  const missingRequirements = requirements.filter(
    (requirement) =>
      !availableConnections.some(
        (connection) =>
          connection.provider === requirement.connector &&
          (connection.id === requirement.connectionId || connection.name === requirement.connectionId),
      ),
  );
  const missingConnectors = requirements
    .map((item) => item.connector)
    .filter((connector, index, all) => all.indexOf(connector) === index)
    .filter((connector) => !availableProviders.has(connector));

  return {
    templateId: template.id,
    templateName: template.name,
    requirements,
    missingRequirements,
    availableProviders: Array.from(availableProviders.values()),
    missingConnectors,
    ready: missingRequirements.length === 0,
  };
}

export async function installTemplate(service: ControlPlaneService, actor: ActorContext, templateId: string) {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }
  const workflow = await service.createWorkflow(actor, template.name);
  return service.publishWorkflowVersion(actor, workflow.id, template.dslJson);
}
