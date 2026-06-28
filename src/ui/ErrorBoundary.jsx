import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught', error, info)
    this.setState({ info })
  }

  componentDidMount() {
    if (typeof window === 'undefined') return
    this._onError = (event) => {
      console.error('[window.onerror]', event.error || event.message)
      this.setState({
        error: event.error || new Error(event.message || 'Unknown error'),
        info: { componentStack: 'window.onerror' },
      })
    }
    this._onRejection = (event) => {
      console.error('[unhandledrejection]', event.reason)
      this.setState({
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        info: { componentStack: 'unhandledrejection' },
      })
    }
    window.addEventListener('error', this._onError)
    window.addEventListener('unhandledrejection', this._onRejection)
  }

  componentWillUnmount() {
    if (typeof window === 'undefined') return
    if (this._onError) window.removeEventListener('error', this._onError)
    if (this._onRejection) window.removeEventListener('unhandledrejection', this._onRejection)
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  handleDismiss = () => {
    this.setState({ error: null, info: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen-overlay error-overlay">
        <div className="glass-panel error-card">
          <div className="error-icon">⚠️</div>
          <div className="error-title">Something went wrong</div>
          <p className="error-message">
            The game encountered an unexpected error and couldn’t continue.
          </p>
          <pre className="error-detail">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="error-actions">
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={this.handleReload}
            >
              Reload Game
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={this.handleDismiss}
              style={{ marginTop: 8 }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }
}