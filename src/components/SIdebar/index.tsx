import styled from 'styled-components';

const StyledSidebar = styled.div`
    width: 250px;
    height: calc(100vh - 20px);
    background-color: #f4f4f4;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid #ddd;
    margin: 5px;
    border-radius: 5px;
`;

type SidebarProps = {
    sections: { title: string; items: string[] }[];
};

const Sidebar = ({ sections }: SidebarProps) => {
  return (
    <StyledSidebar>
        <img src="/logo.svg" alt="ColCalc Logo" />
    </StyledSidebar>
  );
};

export default Sidebar;