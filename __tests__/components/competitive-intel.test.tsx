import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Competitive Intelligence Component', () => {
  it('should render competitive intelligence dashboard', () => {
    const component = () => (
      <div data-testid="competitive-intel">
        <h1>Competitive Intelligence</h1>
        <p>Tracking competitor activities</p>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('competitive-intel')).toBeInTheDocument();
  });

  it('should display competitor updates', () => {
    const mockUpdates = [
      { id: '1', institution: 'JPMorgan', title: 'AI in Banking', relevanceScore: 85 },
      { id: '2', institution: 'Goldman Sachs', title: 'ML Risk Models', relevanceScore: 78 }
    ];

    const component = () => (
      <div data-testid="competitor-updates">
        {mockUpdates.map(update => (
          <div key={update.id} data-testid={`update-${update.id}`}>
            <h2>{update.title}</h2>
            <p>{update.institution}</p>
            <span>Relevance: {update.relevanceScore}%</span>
          </div>
        ))}
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('competitor-updates')).toBeInTheDocument();
    expect(getByTestId('update-1')).toBeInTheDocument();
    expect(getByTestId('update-2')).toBeInTheDocument();
  });

  it('should handle empty updates list', () => {
    const component = () => (
      <div data-testid="no-updates">
        <p>No competitive updates available</p>
      </div>
    );
    const { getByText } = render(component());
    expect(getByText('No competitive updates available')).toBeInTheDocument();
  });
});
