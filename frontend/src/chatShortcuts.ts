// Problem 9: chat shortcuts. Any component can open the chat (and optionally ask a question)
// with openAssistant(); ChatWidget listens for the event.

const EVENT = 'cc:open-chat'

export function openAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { question } }))
}

export function onOpenAssistant(handler: (question?: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<{ question?: string }>).detail?.question)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/** One-click questions for the chat panel, chosen for the page the shopper is on. */
export function suggestionsFor(onProductPage: boolean): string[] {
  if (onProductPage) {
    return [
      'Is this in stock in medium?',
      'What does this one look like?',
      'Do you have this in another color?',
      'Show me similar items under $60',
    ]
  }
  return ['What hoodies do you have?', 'Gift ideas under $60', "What's your cheapest crewneck?", 'Show me Branford College gear']
}
