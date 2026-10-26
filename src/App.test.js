import { render } from '@testing-library/react';
import App from './App';

// Mock the child components to prevent complex dependency issues
jest.mock('./AuthPage', () => {
  return function MockAuthPage() {
    return <div data-testid="auth-page">Authentication Page</div>;
  };
});

jest.mock('./listpage', () => {
  return function MockListPage() {
    return <div data-testid="list-page">List Page</div>;
  };
});

jest.mock('./AnalysisPage', () => {
  return function MockAnalysisPage() {
    return <div data-testid="analysis-page">Analysis Page</div>;
  };
});

// Mock localStorage for authentication
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(() => null),
    removeItem: jest.fn(() => null),
  },
  writable: true
});

test('renders app without crashing', () => {
  // Just test that the App component can be rendered without errors
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});
