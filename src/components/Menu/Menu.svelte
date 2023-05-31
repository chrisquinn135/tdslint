<script>
    import First from "./First.svelte";
    import Second from "./Second.svelte";

    import { activeMenu } from "../../store";

    // set the active tab
    let active;
    activeMenu.subscribe((value) => {
        active = value;
    });
</script>

<div class='container'>
    <div>
        <First name={"Error"} id={"error"} />
        <Second name={"Color"} id={"color"} isActive={active == "color"} number={10}/>
        <Second name={"Font"} id={"font"} isActive={active == "font"} number={10}/>
    </div>
    <div>
        <First name={"Beta"} id={"beta"} isActive={active == "beta"} />
        <Second name={"Auto Layout"} id={"frame"} isActive={active == "frame"} number={50}/>
        <Second name={"Component"} id={"component"} isActive={active == "component"} number={10}/>
    </div>
</div>

<style>
    .container {
        margin: 0px 8px;
    }
</style>