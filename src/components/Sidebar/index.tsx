import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import styled from 'styled-components';
import LoginDialog from '../Auth/LoginDialog';
import { useAuth } from '../../auth/AuthContext';

const StyledSidebar = styled.div`
    width: 250px;
    min-width: 250px;
    height: 100%;
    max-height: 100%;
    box-sizing: border-box;
    background-color: #f0f4ec;
    display: flex;
    flex-direction: column;
    gap: 24px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px 12px;
    overflow: hidden;

    @media (max-width: 768px) {
      width: 100%;
      min-width: 0;
      height: auto;
      max-height: none;
    }
`;

const SidebarHeader = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

const SidebarNav = styled.nav<{ $open: boolean }>`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  @media (max-width: 768px) { display: ${({ $open }) => $open ? 'flex' : 'none'}; }
`;

const Logo = styled.img`
  height: 32px;
  width: 32px;
`;

const HeaderTitle = styled.div`
  margin-inline-start: 10px;
  color: #204f41;
  font-size: 1.35rem;
  font-weight: 600;
`;

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h2`
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .12em;
  margin: 0 12px;
  font-weight: 600;
  color: #204f41;
`;

const SectionItem = styled(NavLink)`
  text-decoration: none;
  color: #555;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: background-color 0.15s ease, color 0.15s ease;
  &:hover {
    background-color: #e8e8e8;
    color: #333;
  }
  &.active {
    background-color: #dce8d7;
    color: #222;
    font-weight: 500;
  }
`;

const DonateSection = styled.div<{ $open: boolean }>`
  @media (max-width: 768px) { display: ${({ $open }) => $open ? 'block' : 'none'}; }
  flex-shrink: 0;
  padding-top: 12px;
  border-top: 1px solid #ddd;
`;

const AccountSection = styled.div<{ $open: boolean }>`
  flex-shrink: 0;
  padding-top: 12px;
  border-top: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  gap: 8px;
  @media (max-width: 768px) { display: ${({ $open }) => $open ? 'flex' : 'none'}; }
`;

const MobileMenu = styled.button`
  display: none;
  margin-left: auto;
  border: 1px solid #b8c8bb;
  border-radius: 7px;
  padding: 8px 12px;
  background: white;
  color: #204f41;
  font: inherit;
  cursor: pointer;
  @media (max-width: 768px) { display: block; }
`;

const AccountEmail = styled.div`
  font-size: 0.8rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AccountButton = styled.button`
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
  &:hover {
    background: #f0f0f0;
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const DonateLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #0070ba 0%, #1546a0 100%);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  transition: opacity 0.15s ease, transform 0.15s ease;
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
`;

type SidebarProps = {
    sections: { 
      title: string;
      // `matchPaths` are extra pathnames that should also highlight the item —
      // e.g. the index route renders the calculator but its URL is "/".
      items: { href: string; alt: string; matchPaths?: string[] }[]
    }[];
};

const Sidebar = ({ sections }: SidebarProps) => {
  const { user, status, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <StyledSidebar>
        <SidebarHeader>
            <Logo src="/logo.svg" alt="ColCalc Logo" />
            <HeaderTitle>ColCalc</HeaderTitle>
            <MobileMenu type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(open => !open)}>Menu</MobileMenu>
        </SidebarHeader>
        <SidebarNav id="primary-navigation" $open={menuOpen}>
          {sections.map((section) => (
            <SidebarSection key={section.title}>
              {section.title !== "none" && <SectionTitle>{section.title}</SectionTitle>}
              {section.items.map((item) => (
                <SectionItem
                  key={item.href}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  end={item.href === "/" || item.href === "/app"}
                  // A plain string here — styled-components merges it with its
                  // own classes, and NavLink still appends "active" on a real
                  // match. A function className would clobber both.
                  className={item.matchPaths?.includes(pathname) ? 'active' : undefined}
                >
                  {item.alt}
                </SectionItem>
              ))}
            </SidebarSection>
          ))}
        </SidebarNav>
        <AccountSection $open={menuOpen}>
          {status === 'authenticated' && user ? (
            <>
              <AccountEmail title={user.email}>{user.email}</AccountEmail>
              <AccountButton type="button" onClick={() => void logout()}>
                Sign out
              </AccountButton>
            </>
          ) : (
            <AccountButton
              type="button"
              onClick={() => setLoginOpen(true)}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Loading…' : 'Sign in for calculator sync'}
            </AccountButton>
          )}
        </AccountSection>
        <DonateSection $open={menuOpen}>
          <DonateLink
            href="https://www.paypal.me/VIctorVargas997"
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate via PayPal
          </DonateLink>
        </DonateSection>
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </StyledSidebar>
  );
};

export default Sidebar;