import React from 'react';

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page render failed:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[420px] items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            !
          </div>
          <h2 className="text-lg font-bold text-stone-900">This page could not be displayed</h2>
          <p className="mt-2 text-sm text-stone-500">
            A display error happened while loading this module. Try again, or reload the app if the page still does not open.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.retry}
              className="rounded-lg bg-wood-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-wood-750"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
