import packageJson from '../package.json'

export function getAppVersion(): string {
  return packageJson.version
}

export function getCurrentYear(): number {
  return new Date().getFullYear()
}