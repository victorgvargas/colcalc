import styled from "styled-components";
import Sidebar from "../Sidebar";
import { Outlet } from "react-router-dom";

const Container = styled.div`
    display: flex;
    height: 100vh;
    width: 100vw;
    padding: 10px;
    box-sizing: border-box;
    background-color: #f9f9f9;
`;

const Layout = () => {
    const sidebarSections = [
        {
            title: "none",
            items: [
                { href: "/", alt: "Dashboard" },
            ]
        },
        {
            title: "Tools",
            items: [
                { href: "/calculator", alt: "Calculator" },
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