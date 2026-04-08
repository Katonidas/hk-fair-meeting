const TERMS_KEY = 'hk-fair-terms'
const QOS_KEY = 'hk-fair-qos'

const DEFAULT_TERMS = `• FOB
• CE & RoHS Certificate and Test Report per item
• Payment Terms: 10% Deposit + 90% Balance after Inspection before delivery
• Warranty: Minimum 1% Free of Charge
• Colour Box Packaging included in price`

const DEFAULT_QOS = `• Enquiries: reply required within 24 hours
• Proforma invoice payment: within 24 hours maximum
• Requirement sheets confirmation: within 24 hours
• Production time: 35 days from deposit`

export function getTerms(): string {
  return localStorage.getItem(TERMS_KEY) || DEFAULT_TERMS
}

export function setTerms(value: string) {
  localStorage.setItem(TERMS_KEY, value)
}

export function getQOS(): string {
  return localStorage.getItem(QOS_KEY) || DEFAULT_QOS
}

export function setQOS(value: string) {
  localStorage.setItem(QOS_KEY, value)
}
