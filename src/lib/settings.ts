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

const CC_KEY = 'hk-fair-cc-emails'

const DEFAULT_CC = `joseluis@approx.es
carlos@approx.es
chen@approx.es
jesus@approx.es`

export function getCCEmailsSetting(): string {
  return localStorage.getItem(CC_KEY) || DEFAULT_CC
}

export function setCCEmailsSetting(value: string) {
  localStorage.setItem(CC_KEY, value)
}

export function getCCEmailsList(): string[] {
  return getCCEmailsSetting().split('\n').map(e => e.trim()).filter(Boolean)
}

// Formulas for target cost calculation
const FORMULA_GAME_KEY = 'hk-fair-formula-game'
const FORMULA_TICNOVA_KEY = 'hk-fair-formula-ticnova'

// Divisors: the number that divides the result after IVA and margin
// GAME: ((PVPR/1.21)*(1-margin))/1.35
// TICNOVA: ((PVPR/1.21)*(1-margin))/1.50
const DEFAULT_FORMULA_GAME = '1.35'
const DEFAULT_FORMULA_TICNOVA = '1.50'

export function getFormulaGame(): number {
  return parseFloat(localStorage.getItem(FORMULA_GAME_KEY) || DEFAULT_FORMULA_GAME)
}

export function setFormulaGame(value: string) {
  localStorage.setItem(FORMULA_GAME_KEY, value)
}

export function getFormulaTicnova(): number {
  return parseFloat(localStorage.getItem(FORMULA_TICNOVA_KEY) || DEFAULT_FORMULA_TICNOVA)
}

export function setFormulaTicnova(value: string) {
  localStorage.setItem(FORMULA_TICNOVA_KEY, value)
}

export function getFormulaGameStr(): string {
  return localStorage.getItem(FORMULA_GAME_KEY) || DEFAULT_FORMULA_GAME
}

export function getFormulaTicnovaStr(): string {
  return localStorage.getItem(FORMULA_TICNOVA_KEY) || DEFAULT_FORMULA_TICNOVA
}
