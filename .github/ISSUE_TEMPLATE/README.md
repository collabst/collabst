# Issue Templates Guide

This directory contains issue templates to help organize and track work in the Collabst project.

## 📋 Available Templates

### 🐛 Bug Report
**Use when:** Something is broken or not working as expected
- Report defects, errors, or unexpected behavior
- Track issues that need fixing
- Document reproduction steps and environment

### ✨ Feature Request
**Use when:** Proposing new functionality
- Suggest new features or capabilities
- Describe user needs and expected outcomes
- Propose solutions to new problems

### 🚀 Enhancement
**Use when:** Improving existing features
- Optimize or refine current functionality
- Polish user experience
- Make incremental improvements to what already works

### ✅ Task / TODO
**Use when:** Tracking work items and action items
- General tasks that need to be done
- Action items from meetings or discussions
- Simple work tracking without complex requirements
- Quick TODO items

### 🔧 Technical Task
**Use when:** Technical improvements or infrastructure work
- Refactoring code
- Performance optimization
- Technical debt reduction
- Infrastructure changes (CI/CD, Docker, etc.)
- Code quality improvements
- Security enhancements
- Dependency upgrades

### 📚 Documentation
**Use when:** Creating or updating documentation
- Write user guides or tutorials
- Update API documentation
- Create architecture diagrams
- Improve README files
- Add code comments or docstrings

### ❓ Question / Discussion
**Use when:** Asking questions or starting discussions
- Need help or clarification
- Want to discuss implementation approaches
- Seeking advice on best practices
- General questions about the project

## 🏷️ Labels

The templates automatically apply these labels:
- `bug` - Something isn't working
- `feature` - New feature or request
- `enhancement` - Improvement to existing feature
- `task` - Work item or TODO
- `technical` - Technical/infrastructure work
- `documentation` - Documentation updates
- `question` - Questions or discussions

## 🎯 Priority Levels

Most templates include priority checkboxes:
- **Critical/Urgent** - Drop everything, address immediately
- **High** - Important, schedule soon
- **Medium** - Normal priority, plan appropriately
- **Low** - Nice to have, backlog item

## 📊 Effort Estimation

Use these estimates for planning:
- **XS** - Few hours
- **S** - 1-2 days
- **M** - 3-5 days
- **L** - 1-2 weeks
- **XL** - 2+ weeks

## 🔗 Linking Issues

Use these keywords to link issues:
- `Related to #123` - General relationship
- `Blocks #123` - This issue blocks another
- `Blocked by #123` - This issue is blocked by another
- `Depends on #123` - Dependency relationship
- `Fixes #123` - This PR/issue fixes another
- `Part of #123` - This is part of a larger issue

## 📝 Best Practices

1. **Choose the right template** - Pick the template that best fits your need
2. **Fill out all relevant sections** - More context helps everyone
3. **Check existing issues** - Avoid duplicates
4. **Use clear titles** - Make issues easy to find
5. **Add labels** - Help with filtering and organization
6. **Link related issues** - Build connections between related work
7. **Update as you go** - Check off completed items in checklists
8. **Close when done** - Keep the issue tracker clean

## 🏗️ Project Structure Reference

When filling out "Components Affected" sections, these map to:

- **Frontend** → `/frontend/` (SvelteKit)
- **Backend** → `/backend/` (FastAPI)
- **Database** → PostgreSQL schemas and migrations
- **Real-time** → WebSocket handlers and Yjs integration
- **Redis** → Caching and session management
- **CI/CD** → GitHub Actions, deployment scripts
- **Docker** → Docker configurations and compose files
- **Documentation** → README, ARCHITECTURE.md, etc.

## 🤝 Contributing

When creating issues:
1. Use the appropriate template
2. Provide as much detail as possible
3. Be respectful and constructive
4. Follow the code of conduct
5. Engage in discussions on your issues

## 💡 Tips

- **Don't know which template?** Start with Task/TODO for simple items
- **Large features?** Consider breaking into multiple issues
- **Technical work?** Use Technical Task to track refactoring and infrastructure
- **Just a question?** Use the Question template or GitHub Discussions
- **Documentation needed?** Use the Documentation template to track it properly

---

For more information, see the [Contributing Guide](../../CONTRIBUTING.md) or start a [Discussion](https://github.com/maximevaillant/Collabst/discussions).

