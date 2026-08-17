import { Component, ErrorInfo, ReactNode } from 'react'
import { reportException } from '@/lib/monitoring'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)

    reportException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="section">
          <h2>Something went wrong</h2>
          <p className="text-muted reading">
            An error occurred while processing your request. Your files were not sent anywhere -
            there is nothing to clean up, and trying again is safe.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
