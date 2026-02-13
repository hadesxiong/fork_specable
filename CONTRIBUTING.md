# Contributing to Specable

Thank you for your interest in contributing to Specable.

## Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/specable.git
   cd specable
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm dev
   ```

4. **Run tests**

   ```bash
   pnpm test
   ```

## Project Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── services/       # Core services (file system, validation pipeline, etc.)
├── store/          # Zustand store
├── test/           # Test setup and utilities
├── types/          # Shared TypeScript type definitions
├── utils/          # Utility functions
└── workers/        # Web Workers for heavy processing
```

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Keep variable and function names descriptive and concise
- Avoid adding comments that restate what the code does
- Run `pnpm lint` before committing

## Submitting Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**

   - Keep commits focused and atomic
   - Use conventional commit messages:
     - `feat:` for new features
     - `fix:` for bug fixes
     - `refactor:` for code changes that neither fix bugs nor add features
     - `docs:` for documentation changes
     - `test:` for adding or updating tests

3. **Run checks**

   ```bash
   pnpm lint
   pnpm test:run
   pnpm build
   ```

4. **Push and create a pull request**

   ```bash
   git push origin feat/your-feature-name
   ```

   Then open a pull request on GitHub.

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure all checks pass
- Keep PRs focused on a single change

## Reporting Issues

- Check existing issues before creating a new one
- Provide steps to reproduce for bugs
- Include browser and OS information when relevant

## Questions

If you have questions, feel free to open a discussion or issue on GitHub.
