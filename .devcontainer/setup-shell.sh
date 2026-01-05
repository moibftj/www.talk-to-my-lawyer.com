#!/bin/sh
# Shell setup script for dev container
# This installs and configures a powerful Bash environment

set -e

echo "📦 Installing dependencies..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    bash-completion \
    git \
    curl \
    vim \
    less \
    ripgrep \
    fd-find \
    2>/dev/null

echo "🔧 Configuring git defaults..."
# Avoid git pull divergence prompt by selecting merge behavior if unset.
if ! git config --global --get pull.rebase >/dev/null 2>&1; then
    git config --global pull.rebase false
fi

echo "🔧 Configuring powerful Bash environment..."

# Backup existing .bashrc
[ -f "$HOME/.bashrc" ] && cp "$HOME/.bashrc" "$HOME/.bashrc.backup"

# Write new .bashrc configuration
cat > "$HOME/.bashrc" << 'BASHRC_EOF'
# ==============================================
# Powerful Bash Configuration
# ==============================================

# Better history
export HISTSIZE=10000
export HISTFILESIZE=20000
export HISTCONTROL=ignoreboth:erasedups
shopt -s histappend

# Auto-change directory (type directory name to cd into it)
shopt -s autocd 2>/dev/null

# Case-insensitive globbing
shopt -s nocaseglob 2>/dev/null

# Multi-line commands
shopt -s cmdhist

# Append to history file, don't overwrite
shopt -s histappend

# Check window size after each command
shopt -s checkwinsize

# Enable ** globbing for recursive searches
if [[ ${BASH_VERSINFO[0]} -ge 4 ]]; then
    shopt -s globstar 2>/dev/null
fi

# ==============================================
# Completion
# ==============================================
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# ==============================================
# Colors
# ==============================================
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

# ==============================================
# Prompt with Git branch
# ==============================================
parse_git_branch() {
    git branch 2>/dev/null | sed -n 's/* \(.*\)/\1/p'
}

# Color prompt
force_color_prompt=yes
if [ -n "$force_color_prompt" ]; then
    if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
        color_prompt=yes
    else
        color_prompt=
    fi
fi

if [ "$color_prompt" = yes ]; then
    PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\[\033[01;33m\]$(parse_git_branch)\[\033[00m\]\$ '
else
    PS1='\u@\h:\w$(parse_git_branch)\$ '
fi

unset color_prompt force_color_prompt

# ==============================================
# Editor
# ==============================================
export EDITOR='vim'
export VISUAL='vim'

# ==============================================
# pnpm
# ==============================================
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
    *":$PNPM_HOME:"*) ;;
    *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# ==============================================
# Useful Aliases
# ==============================================

# Navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ~='cd ~'
alias c='clear'
alias h='history'
alias path='echo -e ${PATH//:/\\n}'
alias now='date +"%T"'
alias nowdate='date +"%Y-%m-%d"'

# Listing
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias lt='ls -lhtr'

# Git
alias gs='git status'
alias ga='git add'
alias gc='git commit -v'
alias gd='git diff'
alias gp='git push'
alias gl='git pull'
alias gb='git branch'
alias gco='git checkout'
alias lg='git log --graph --oneline --decorate --all'

# Development (pnpm)
alias p='pnpm'
alias pi='pnpm install'
alias pd='pnpm dev'
alias pb='pnpm build'
alias pl='pnpm lint'
alias pt='pnpm test'
alias px='pnpm exec'

# Ripgrep/fd shortcuts (if available)
command -v rg >/dev/null 2>&1 && alias grep='rg --color=auto'
command -v fd >/dev/null 2>&1 && alias find='fd'

# ==============================================
# Useful Functions
# ==============================================

# mkdir + cd
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Extract any archive
extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2)   tar xjf "$1"     ;;
            *.tar.gz)    tar xzf "$1"     ;;
            *.bz2)       bunzip2 "$1"     ;;
            *.rar)       unrar x "$1"     ;;
            *.gz)        gunzip "$1"      ;;
            *.tar)       tar xf "$1"      ;;
            *.tbz2)      tar xjf "$1"     ;;
            *.tgz)       tar xzf "$1"     ;;
            *.zip)       unzip "$1"       ;;
            *.Z)         uncompress "$1"  ;;
            *)           echo "'$1' cannot be extracted via extract()" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

# Find files by name
f() {
    find . -iname "*$1*" "${@:2}"
}

# Grep processes
psgrep() {
    ps aux | grep -v grep | grep -i -e VSZ -e "$@"
}

# Create timestamped backup
backup() {
    cp "$1" "$1.backup-$(date +%Y%m%d_%H%M%S)"
}

# Quick weather
weather() {
    if command -v curl >/dev/null 2>&1; then
        curl -s "wttr.in/$1"
    else
        echo "curl not installed"
    fi
}

# Show git branches with latest commit
gbv() {
    for branch in $(git branch -a); do
        echo "$(git log -1 --format='%ci %cr' $branch | head -n 1) $branch"
    done | sort -r
}

# ==============================================
# Auto-source local bashrc if exists
# ==============================================
cd() {
    builtin cd "$@" || return
    if [ -f ".bashrc.local" ]; then
        source ".bashrc.local"
    fi
}

# ==============================================
# Welcome message
# ==============================================
echo "🚀 Powerful Bash environment loaded!"
BASHRC_EOF

# Also set up .bash_profile for login shells
cat > "$HOME/.bash_profile" << 'BASH_PROFILE_EOF'
# .bash_profile - executed for login shells
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi
BASH_PROFILE_EOF

echo "✅ Shell setup complete!"
echo "📝 Configuration written to ~/.bashrc"
echo "🔄 Restart your terminal or run: source ~/.bashrc"
