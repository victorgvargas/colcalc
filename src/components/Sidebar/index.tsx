import { NavLink } from 'react-router';
import styled from 'styled-components';

const StyledSidebar = styled.div`
    width: 250px;
    height: calc(100vh - 20px);
    background-color: #f4f4f4;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid #ddd;
    border-radius: 5px;
`;

const SidebarSection = styled.div`
  display:flex;
  flex-direction: column;
  gap: 6px;
`;

const SectionTitle = styled.h2`
  text-style: bold;
`;

const SectionItem = styled(NavLink)`
  text-decoration: none;
  color: #333;
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
        <img src="/logo.svg" alt="ColCalc Logo" />
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