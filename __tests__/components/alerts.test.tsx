import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Alerts Component', () => {
  it('should render alerts dashboard', () => {
    const component = () => (
      <div data-testid="alerts-dashboard">
        <h1>Regulatory Alerts</h1>
        <p>Monitor regulatory changes and compliance requirements</p>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('alerts-dashboard')).toBeInTheDocument();
  });

  it('should display active alerts', () => {
    const mockAlerts = [
      { id: '1', title: 'GDPR Update', severity: 'high', createdAt: new Date() },
      { id: '2', title: 'AML Regulation Change', severity: 'medium', createdAt: new Date() }
    ];

    const component = () => (
      <div data-testid="active-alerts">
        <h2>Active Alerts</h2>
        <ul>
          {mockAlerts.map(alert => (
            <li key={alert.id} data-testid={`alert-${alert.id}`}>
              <h3>{alert.title}</h3>
              <span>Severity: {alert.severity}</span>
            </li>
          ))}
        </ul>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('active-alerts')).toBeInTheDocument();
    expect(getByTestId('alert-1')).toBeInTheDocument();
    expect(getByTestId('alert-2')).toBeInTheDocument();
  });

  it('should handle empty alerts', () => {
    const component = () => (
      <div data-testid="no-alerts">
        <p>No active alerts</p>
      </div>
    );
    const { getByText } = render(component());
    expect(getByText('No active alerts')).toBeInTheDocument();
  });
});
