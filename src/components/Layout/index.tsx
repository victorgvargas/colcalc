import styled from "styled-components";
import Sidebar from "../Sidebar";
import SEO from "../SEO";
import { Outlet } from "react-router-dom";

const Container = styled.div`
    display: flex;
    gap: 12px;
    height: calc(100vh - 20px);
    width: calc(100vw - 20px);
    margin: 10px 5px;
    box-sizing: border-box;
`;

const MainContent = styled.main`
    flex: 1;
    min-width: 0;
    background-color: #fafafa;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 24px;
    overflow: auto;
`;

const Layout = () => {
    const sidebarSections = [
        {
            title: "none",
            items: [
                { href: "/calculator", alt: "Calculator" },
            ]
        },
        {
            title: "none",
            items: [
                { href: "/cities-comparison", alt: "Cities comparison" },
            ]
        },
        {
            title: "none",
            items: [
                { href: "/purchasing-power", alt: "Purchasing power parity" },
            ]
        },
        {
            title: "none",
            items: [
                { href: "/tax-calculator", alt: "Tax calculator" },
            ]
        }
    ];

    return (
        <Container>
            <SEO />
            <Sidebar sections={sidebarSections}/>
            <MainContent>
                <Outlet />
            </MainContent>
        </Container>
    );
};

export default Layout;