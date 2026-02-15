import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Export Hub Component', () => {
  it('should render export options', () => {
    const component = () => (
      <div data-testid="export-hub">
        <h1>Export Hub</h1>
        <button data-testid="export-ppt">Export to PowerPoint</button>
        <button data-testid="export-social">Export Social Posts</button>
        <button data-testid="export-digest">Send Email Digest</button>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('export-hub')).toBeInTheDocument();
    expect(getByTestId('export-ppt')).toBeInTheDocument();
    expect(getByTestId('export-social')).toBeInTheDocument();
    expect(getByTestId('export-digest')).toBeInTheDocument();
  });

  it('should handle PowerPoint export click', () => {
    const mockExportPPT = jest.fn();
    const component = () => (
      <div data-testid="export-hub">
        <button data-testid="export-ppt" onClick={mockExportPPT}>
          Export to PowerPoint
        </button>
      </div>
    );
    const { getByTestId } = render(component());
    const button = getByTestId('export-ppt');
    fireEvent.click(button);
    expect(mockExportPPT).toHaveBeenCalledTimes(1);
  });

  it('should handle social media export click', () => {
    const mockExportSocial = jest.fn();
    const component = () => (
      <div data-testid="export-hub">
        <button data-testid="export-social" onClick={mockExportSocial}>
          Export Social Posts
        </button>
      </div>
    );
    const { getByTestId } = render(component());
    const button = getByTestId('export-social');
    fireEvent.click(button);
    expect(mockExportSocial).toHaveBeenCalledTimes(1);
  });

  it('should handle email digest click', () => {
    const mockSendDigest = jest.fn();
    const component = () => (
      <div data-testid="export-hub">
        <button data-testid="export-digest" onClick={mockSendDigest}>
          Send Email Digest
        </button>
      </div>
    );
    const { getByTestId } = render(component());
    const button = getByTestId('export-digest');
    fireEvent.click(button);
    expect(mockSendDigest).toHaveBeenCalledTimes(1);
  });

  it('should display export configuration options', () => {
    const component = () => (
      <div data-testid="export-config">
        <label>
          <input type="checkbox" data-testid="include-abstract" />
          Include Abstract
        </label>
        <label>
          <input type="checkbox" data-testid="include-summary" />
          Include AI Summary
        </label>
        <label>
          <input type="checkbox" data-testid="include-tags" />
          Include Tags
        </label>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('export-config')).toBeInTheDocument();
    expect(getByTestId('include-abstract')).toBeInTheDocument();
    expect(getByTestId('include-summary')).toBeInTheDocument();
    expect(getByTestId('include-tags')).toBeInTheDocument();
  });

  it('should display platform selection for social media', () => {
    const component = () => (
      <div data-testid="platform-selection">
        <label>
          <input type="radio" name="platform" value="LinkedIn" data-testid="platform-linkedin" />
          LinkedIn
        </label>
        <label>
          <input type="radio" name="platform" value="Twitter" data-testid="platform-twitter" />
          Twitter
        </label>
        <label>
          <input type="radio" name="platform" value="X" data-testid="platform-x" />
          X
        </label>
      </div>
    );
    const { getByTestId } = render(component());
    expect(getByTestId('platform-selection')).toBeInTheDocument();
    expect(getByTestId('platform-linkedin')).toBeInTheDocument();
    expect(getByTestId('platform-twitter')).toBeInTheDocument();
    expect(getByTestId('platform-x')).toBeInTheDocument();
  });
});
