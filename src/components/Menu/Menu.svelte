<script>
    import First from "./First.svelte";
    import Second from "./Second.svelte";

    import { activeMenu, activeTab } from "../../store";

    export let color;
    export let font;

    // set the active menu
    let active;
    activeMenu.subscribe((value) => {
        active = value;
    });

</script>

<div class='container'>
    <div>
        <First name={"Error"}/>
        <Second name={"Color"} id={"color"} isActive={active == "color"} number={color}/>
        <Second name={"Font"} id={"font"} isActive={active == "font"} number={font}/>
    </div>
    <div>
        <First name={"Beta"}/>
        <Second name={"Auto Layout"} id={"frame"} isActive={active == "frame"} number={50}/>
        <Second name={"Component"} id={"component"} isActive={active == "component"} number={10}/>
    </div>
</div>

<style>
    .container {
        margin: 0px 8px;
    }
</style>