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

const HeaderTitle = styled.h1`
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
    </StyledSidebar>
  );
};

export default Sidebar;