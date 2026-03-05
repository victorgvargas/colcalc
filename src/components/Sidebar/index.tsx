import { NavLink } from 'react-router';
import styled from 'styled-components';

const StyledSidebar = styled.div`
    width: 250px;
    min-width: 250px;
    height: 100%;
    max-height: 100%;
    box-sizing: border-box;
    background-color: #f4f4f4;
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

const SidebarNav = styled.nav`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
`;

const Logo = styled.img`
  height: 32px;
  width: 32px;
`;

const HeaderTitle = styled.div`
  margin-inline-start: 10px;
  color: #444;
  font-size: 1.25rem;
  font-weight: 600;
`;

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h2`
  font-weight: 600;
  color: #444;
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
    background-color: #e0e0e0;
    color: #222;
    font-weight: 500;
  }
`;

const DonateSection = styled.div`
  flex-shrink: 0;
  padding-top: 12px;
  border-top: 1px solid #ddd;
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
      items: { href: string; alt: string }[] 
    }[];
};

const Sidebar = ({ sections }: SidebarProps) => {
  return (
    <StyledSidebar>
        <SidebarHeader>
            <Logo src="/logo.svg" alt="ColCalc Logo" />
            <HeaderTitle>ColCalc</HeaderTitle>
        </SidebarHeader>
        <SidebarNav>
          {sections.map((section) => (
            <SidebarSection key={section.title}>
              {section.title !== "none" && <SectionTitle>{section.title}</SectionTitle>}
              {section.items.map((item) => (
                <SectionItem key={item.href} to={item.href}>{item.alt}</SectionItem>
              ))}
            </SidebarSection>
          ))}
        </SidebarNav>
        <DonateSection>
          <DonateLink
            href="https://www.paypal.me/VIctorVargas997"
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate via PayPal
          </DonateLink>
        </DonateSection>
    </StyledSidebar>
  );
};

export default Sidebar;