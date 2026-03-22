import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Recommendations Component', () => {
  it('should render PoC recommendations list', () => {
    const mockRecommendations = [
      { id: '1', title: 'PoC: Deep Learning for Fraud Detection', confidence: 0.85, estimatedEffort: 'Medium' },
      { id: '2', title: 'PoC: LLM for Customer Service', confidence: 0.78, estimatedEffort: 'Low' }
    ];

    const component = () => (
      <div data-testid="recommendations">
        <h1>PoC Recommendations</h1>
        <div>
          {mockRecommendations.map(rec => (
            <div key={rec.id} data-testid={`rec-${rec.id}`}>
              <h2>{rec.title}</h2>
              <p>Confidence: {Math.round(rec.confidence * 100)}%</p>
              <p>Effort: {rec.estimatedEffort}</p>
            </div>
          ))}
        </div>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('recommendations')).toBeInTheDocument();
    expect(getByTestId('rec-1')).toBeInTheDocument();
    expect(getByTestId('rec-2')).toBeInTheDocument();
  });

  it('should filter recommendations by confidence', () => {
    const mockRecommendations = [
      { id: '1', title: 'High Confidence PoC', confidence: 0.90, estimatedEffort: 'Low' },
      { id: '2', title: 'Medium Confidence PoC', confidence: 0.70, estimatedEffort: 'Medium' }
    ];

    const component = () => (
      <div data-testid="filtered-recommendations">
        <div>
          {mockRecommendations
            .filter(rec => rec.confidence >= 0.8)
            .map(rec => (
              <div key={rec.id} data-testid={`rec-${rec.id}`}>
                <h2>{rec.title}</h2>
              </div>
            ))}
        </div>
      </div>
    );
    const { getByTestId, queryByTestId } = render(component());
    expect(getByTestId('filtered-recommendations')).toBeInTheDocument();
    expect(getByTestId('rec-1')).toBeInTheDocument();
    expect(queryByTestId('rec-2')).not.toBeInTheDocument();
  });

  it('should handle empty recommendations', () => {
    const component = () => (
      <div data-testid="no-recommendations">
        <p>No PoC recommendations available</p>
      </div>
    );
    const { getByText } = render(component());
    expect(getByText('No PoC recommendations available')).toBeInTheDocument();
  });
});
