import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders default button styles', () => {
    render(<Button>Press</Button>)
    const button = screen.getByRole('button', { name: 'Press' })
    expect(button).toHaveClass('bg-primary')
  })

  it('renders variant styles', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button', { name: 'Outline' })
    expect(button).toHaveClass('border')
  })
})
