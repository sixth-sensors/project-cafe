export enum Page {
  Brew = 'brew',
  Info = 'info',
}
export interface NavbarProps {
  links: NavLink[]
  activePage: Page
  setActivePage: (page: Page) => void
}

export interface BubbleStyle {
  width: number
  height: number
  transform: string
}

export interface NavLink {
  page: Page
  label: string
  colors: {
    primaryColor: string
    secondaryColor: string
    backgroundColor?: string
    textColor: string
  }
}
