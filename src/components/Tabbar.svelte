<script>
    import Tab from "./Tab.svelte";
    import {activeTab } from '../store'

    // set the active tab
    let active;
    activeTab.subscribe(value => {
        active = value;
    })
</script>

<div class="tabbar">
    <Tab name={"Page"} id={"swap"} isActive={active == "swap"}/>
    <Tab name={"Selection"} id={"history"} isActive={active == "history"}/>
    <Tab name={"Configuration"} id={"config"} isActive={active == "config"}/>
</div>

<style>
    .tabbar {
        display: flex;
        grid-gap: 16px;
        border-bottom-style: solid;
        border-color: #d5d5d5;
        border-width: 1px;
        justify-items: center;
        align-items: center;
    }
</style>
