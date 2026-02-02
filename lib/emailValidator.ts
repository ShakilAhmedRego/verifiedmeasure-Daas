// List of free email providers to block
const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'yandex.com', 'zoho.com',
  'gmx.com', 'inbox.com', 'live.com', 'msn.com', 'me.com', 'mac.com',
  'googlemail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.it',
  'outlook.fr', 'outlook.de', 'outlook.it', 'hotmail.fr', 'hotmail.de',
  'hotmail.it', 'hotmail.co.uk', 'live.fr', 'live.de', 'live.it', 'live.co.uk'
]

export function isWorkEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  
  if (!domain) return false
  
  // Check if it's a free email provider
  if (FREE_EMAIL_DOMAINS.includes(domain)) {
    return false
  }
  
  // Must have valid domain structure
  if (!domain.includes('.')) {
    return false
  }
  
  return true
}

export function getEmailError(email: string): string | null {
  if (!email.includes('@')) {
    return 'Please enter a valid email address'
  }
  
  if (!isWorkEmail(email)) {
    return 'Please use your work email address. Personal email providers (Gmail, Yahoo, Outlook, etc.) are not accepted for capital raise lead access.'
  }
  
  return null
}
