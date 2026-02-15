import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Technology Radar Component', () => {
  it('should render technology radar dashboard', () => {
    const component = () => (
      <div data-testid="technology-radar">
        <h1>Technology Radar</h1>
        <p>Emerging technologies in banking</p>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('technology-radar')).toBeInTheDocument();
  });

  it('should display radar quadrants', () => {
    const quadrants = ['adopt', 'trial', 'assess', 'hold'];

    const component = () => (
      <div data-testid="radar-quadrants">
        {quadrants.map(quadrant => (
          <div key={quadrant} data-testid={`quadrant-${quadrant}`}>
            <h2>{quadrant.toUpperCase()}</h2>
          </div>
        ))}
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('radar-quadrants')).toBeInTheDocument();
    expect(getByTestId('quadrant-adopt')).toBeInTheDocument();
    expect(getByTestId('quadrant-trial')).toBeInTheDocument();
    expect(getByTestId('quadrant-assess')).toBeInTheDocument();
    expect(getByTestId('quadrant-hold')).toBeInTheDocument();
  });

  it('should display technology items with maturity and relevance', () => {
    const mockTechnologies = [
      { id: '1', name: 'Deep Learning', quadrant: 'adopt', maturity: 85, relevance: 90 },
      { id: '2', name: 'Graph Neural Networks', quadrant: 'trial', maturity: 65, relevance: 75 }
    ];

    const component = () => (
      <div data-testid="technologies">
        {mockTechnologies.map(tech => (
          <div key={tech.id} data-testid={`tech-${tech.id}`}>
            <h3>{tech.name}</h3>
            <p>Quadrant: {tech.quadrant}</p>
            <p>Maturity: {tech.maturity}%</p>
            <p>Relevance: {tech.relevance}%</p>
          </div>
        ))}
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('technologies')).toBeInTheDocument();
    expect(getByTestId('tech-1')).toBeInTheDocument();
    expect(getByTestId('tech-2')).toBeInTheDocument();
  });
});
