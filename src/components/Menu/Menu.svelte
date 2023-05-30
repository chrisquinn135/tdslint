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

<div>
    <div>
        <First name={"Error"} id={"error"} />
        <Second name={"Color"} id={"color"} isActive={active == "color"} />
        <Second name={"Font"} id={"font"} isActive={active == "font"} />
    </div>
    <div>
        <First name={"Beta"} id={"beta"} isActive={active == "beta"} />
        <Second name={"Frame"} id={"frame"} isActive={active == "frame"} />
        <Second name={"Component"} id={"component"} isActive={active == "component"}/>
    </div>
</div>
