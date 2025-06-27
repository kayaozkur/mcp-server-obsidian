# Pull Request Template - Multi-Agent Development

## 🤖 Agent Information
- **Agent Type**: [ ] Claude Code / [ ] Other AI Agent / [ ] Human Developer
- **Agent ID/Session**: 
- **Coordination Status**: [ ] Workspace claimed / [ ] Collaborative work / [ ] Emergency fix

## 📋 Change Summary
**What does this PR do?**


**Type of change:**
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)  
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Configuration change
- [ ] 🧪 Test improvement
- [ ] ♻️ Code refactoring
- [ ] 🎨 UI/UX improvement

## 🔍 Testing
**How has this been tested?**
- [ ] Unit tests pass (`npm test`)
- [ ] Integration tests pass (`npm run test:integration`)
- [ ] Coverage threshold met (≥50%)
- [ ] Manual testing completed
- [ ] No regressions identified

**Test coverage:**
- New lines covered: _%
- Overall coverage: _%

## 🚀 Quality Checklist
**Code Quality:**
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code follows project conventions
- [ ] No console.log statements in production code
- [ ] No TODO/FIXME comments (or documented in issues)

**Security:**
- [ ] No hardcoded secrets or tokens
- [ ] No eval() or dangerous code patterns
- [ ] Dependencies are secure (npm audit clean)
- [ ] Input validation implemented where needed

**Documentation:**
- [ ] Code is self-documenting or has comments
- [ ] README updated if needed
- [ ] API documentation updated if applicable
- [ ] CHANGELOG updated for user-facing changes

## 🤝 Multi-Agent Coordination
**Conflict Prevention:**
- [ ] Checked for recent changes to modified files
- [ ] No merge conflicts with main branch
- [ ] Coordinated with other active agents/developers
- [ ] Work claimed via agent coordination workflow

**Change Impact:**
- [ ] Breaking changes are documented
- [ ] Migration guide provided (if needed)
- [ ] Backward compatibility maintained
- [ ] Version bump follows semantic versioning

## 📝 Additional Notes
**Anything else reviewers should know:**


**Related Issues:**
- Fixes #
- Relates to #
- Blocks #

## 🔗 Dependencies
**This PR depends on:**
- [ ] No dependencies
- [ ] External library updates
- [ ] Other PRs: #
- [ ] Configuration changes
- [ ] Infrastructure updates

## 🎯 Post-Merge Tasks
**After merging, the following should be done:**
- [ ] Deploy to staging
- [ ] Update documentation
- [ ] Notify team/users
- [ ] Monitor for issues
- [ ] Release new version

---

### 📋 Reviewer Guidelines
**For human reviewers:**
- Focus on logic, architecture, and potential issues
- Automated checks handle formatting and basic quality
- Ensure multi-agent coordination was followed

**For automated reviews:**
- All quality gates must pass before merge
- Security scans must be clean
- Test coverage must meet threshold

**Merge Requirements:**
- [ ] All automated checks pass
- [ ] At least one human approval (if available)
- [ ] No unresolved conversations
- [ ] Branch is up to date with main