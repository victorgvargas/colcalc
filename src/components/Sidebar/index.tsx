import { NavLink } from 'react-router';
import styled from 'styled-components';

const StyledSidebar = styled.div`
    width: 250px;
    height: calc(100vh - 20px);
    background-color: #f4f4f4;
    display: flex;
    flex-direction: column;
    border: 1px solid #ddd;
    border-radius: 5px;
    padding: 0 10px;
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;

`;

const Logo = styled.img`
  height: 32px;
  width: 32px;
`;

const HeaderTitle = styled.h1`
  margin-inline-start: 10px;
  color: #444;
`;

const SidebarSection = styled.div`
  display:flex;
  flex-direction: column;
  gap: 6px;
`;

const SectionTitle = styled.h2`
  text-style: bold;
  color: #444;
`;

const SectionItem = styled(NavLink)`
  text-decoration: none;
  color: #555;
  &:hover {
    text-decoration: underline;
  }
`;

type SidebarProps = {
    sections: { title: string; items: { href: string; alt: string }[] }[];
};

const Sidebar = ({ sections }: SidebarProps) => {
  return (
    <StyledSidebar>
        <SidebarHeader>
            <Logo src="/logo.svg" alt="ColCalc Logo" />
            <HeaderTitle>ColCalc</HeaderTitle>
        </SidebarHeader>
        {sections.map((section) => (
          <SidebarSection key={section.title}>
            {section.title !== "none" && <SectionTitle>{section.title}</SectionTitle>}
            {section.items.map((item) => (
              <SectionItem key={item.href} to={item.href}>{item.alt}</SectionItem>
            ))}
          </SidebarSection>
        ))}
    </StyledSidebar>
  );
};

export default Sidebar;