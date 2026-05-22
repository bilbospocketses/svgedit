/**
 * Centralized logging utility for SVGCanvas.
 * Provides configurable log levels and the ability to disable logging in production.
 * @module logger
 * @license MIT
 */

/**
 * Log levels in order of severity
 * @enum {number}
 */
export const LogLevel = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
} as const

type LogLevelValue = typeof LogLevel[keyof typeof LogLevel]

interface LoggerConfig {
  currentLevel: LogLevelValue
  enabled: boolean
  prefix: string
}

/**
 * Logger configuration
 */
const config: LoggerConfig = {
  currentLevel: LogLevel.WARN,
  enabled: true,
  prefix: '[SVGCanvas]'
}

/**
 * Set the logging level
 * @param level - The log level to set
 */
export const setLogLevel = (level: LogLevelValue): void => {
  if ((Object.values(LogLevel) as LogLevelValue[]).includes(level)) {
    config.currentLevel = level
  }
}

/**
 * Enable or disable logging
 * @param enabled - Whether logging should be enabled
 */
export const setLoggingEnabled = (enabled: boolean): void => {
  config.enabled = Boolean(enabled)
}

/**
 * Set the log prefix
 * @param prefix - The prefix to use for log messages
 */
export const setLogPrefix = (prefix: string): void => {
  config.prefix = String(prefix)
}

/**
 * Format a log message with prefix and context
 * @param message - The log message
 * @param [context=''] - Optional context information
 * @returns Formatted message
 */
const formatMessage = (message: string, context = ''): string => {
  const contextStr = context ? ` [${context}]` : ''
  return `${config.prefix}${contextStr} ${message}`
}

/**
 * Log an error message
 * @param message - The error message
 * @param [errorData] - Optional error object or additional data
 * @param [context=''] - Optional context (e.g., module name)
 */
export const error = (message: string, errorData?: unknown, context = ''): void => {
  if (!config.enabled || config.currentLevel < LogLevel.ERROR) return

  console.error(formatMessage(message, context))
  if (errorData !== undefined) {
    console.error(errorData)
  }
}

/**
 * Log a warning message
 * @param message - The warning message
 * @param [data] - Optional additional data
 * @param [context=''] - Optional context (e.g., module name)
 */
export const warn = (message: string, data?: unknown, context = ''): void => {
  if (!config.enabled || config.currentLevel < LogLevel.WARN) return

  console.warn(formatMessage(message, context))
  if (data !== undefined) {
    console.warn(data)
  }
}

/**
 * Log an info message
 * @param message - The info message
 * @param [data] - Optional additional data
 * @param [context=''] - Optional context (e.g., module name)
 */
export const info = (message: string, data?: unknown, context = ''): void => {
  if (!config.enabled || config.currentLevel < LogLevel.INFO) return

  console.info(formatMessage(message, context))
  if (data !== undefined) {
    console.info(data)
  }
}

/**
 * Log a debug message
 * @param message - The debug message
 * @param [data] - Optional additional data
 * @param [context=''] - Optional context (e.g., module name)
 */
export const debug = (message: string, data?: unknown, context = ''): void => {
  if (!config.enabled || config.currentLevel < LogLevel.DEBUG) return

  console.debug(formatMessage(message, context))
  if (data !== undefined) {
    console.debug(data)
  }
}

/**
 * Get current logger configuration
 * @returns Current configuration
 */
export const getConfig = (): LoggerConfig => ({ ...config })

// Default export as namespace — explicit interface required by isolatedDeclarations
interface LoggerNamespace {
  LogLevel: typeof LogLevel
  setLogLevel: typeof setLogLevel
  setLoggingEnabled: typeof setLoggingEnabled
  setLogPrefix: typeof setLogPrefix
  error: typeof error
  warn: typeof warn
  info: typeof info
  debug: typeof debug
  getConfig: typeof getConfig
}

const loggerNamespace: LoggerNamespace = {
  LogLevel,
  setLogLevel,
  setLoggingEnabled,
  setLogPrefix,
  error,
  warn,
  info,
  debug,
  getConfig
}

export default loggerNamespace
