import styled from "styled-components";
import Sidebar from "../Sidebar";
import { Outlet } from "react-router-dom";
import { faCalculator, faTableColumns } from "@fortawesome/free-solid-svg-icons";

const Container = styled.div`
    display: flex;
    height: calc(100vh - 20px);
    width: calc(100vw - 20px);
    margin: 10px;
    box-sizing: border-box;
`;

const Layout = () => {
    const sidebarSections = [
        {
            title: "none",
            items: [
                { href: "/", alt: "Dashboard", icon: faTableColumns },
            ]
        },
        {
            title: "Tools",
            items: [
                { href: "/calculator", alt: "Calculator", icon: faCalculator },
            ]
        }
    ];

    return (
        <Container>
            <Sidebar sections={sidebarSections}/>
            <Outlet />
        </Container>
    );
};

export default Layout;