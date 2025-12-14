import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, type Command } from './CommandPalette';

// Create fresh mock commands for each test to avoid state leakage
function createMockCommands(): Command[] {
  return [
    {
      id: 'test.command1',
      label: 'Test Command 1',
      shortcut: 'Ctrl+T',
      category: 'edit',
      action: vi.fn() as () => void,
    },
    {
      id: 'test.command2',
      label: 'Another Command',
      category: 'navigation',
      action: vi.fn() as () => void,
    },
    {
      id: 'test.command3',
      label: 'Open File',
      shortcut: 'Ctrl+O',
      category: 'file',
      action: vi.fn() as () => void,
    },
    {
      id: 'test.conditional',
      label: 'Conditional Command',
      category: 'edit',
      action: vi.fn() as () => void,
      when: () => false,
    },
  ];
}

describe('CommandPalette', () => {
  let mockOnClose: Mock<() => void>;
  let mockCommands: Command[];

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockCommands = createMockCommands();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette isOpen={false} onClose={mockOnClose} commands={mockCommands} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders command list when open', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Command 1')).toBeInTheDocument();
    expect(screen.getByText('Another Command')).toBeInTheDocument();
  });

  it('filters out commands with failing when condition', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);
    expect(screen.queryByText('Conditional Command')).not.toBeInTheDocument();
  });

  it('filters commands based on search query', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'Open');

    expect(screen.getByText('Open File')).toBeInTheDocument();
    expect(screen.queryByText('Test Command 1')).not.toBeInTheDocument();
  });

  it('executes command on click', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const commandOption = screen.getByText('Test Command 1').closest('[role="option"]');
    if (commandOption) {
      await user.click(commandOption);
    }

    expect(mockCommands[0].action).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('executes command on Enter key', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');

    expect(mockCommands[0].action).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '{Escape}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes when clicking backdrop', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
    if (backdrop) {
      await user.click(backdrop);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('navigates with arrow keys', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const input = screen.getByRole('textbox');

    // Move down
    await user.type(input, '{ArrowDown}');

    // The second item should now be selected
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('displays keyboard shortcuts', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);
    expect(screen.getByText('Ctrl+T')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+O')).toBeInTheDocument();
  });

  it('displays command categories', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);
    expect(screen.getAllByText('edit').length).toBeGreaterThan(0);
    expect(screen.getByText('navigation')).toBeInTheDocument();
    expect(screen.getByText('file')).toBeInTheDocument();
  });

  it('shows no matches message when filter returns empty', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'xyz123nonexistent');

    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });

  it('has proper ARIA attributes', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} commands={mockCommands} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Command palette');

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Available commands');

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-controls', 'command-list');
  });
});
