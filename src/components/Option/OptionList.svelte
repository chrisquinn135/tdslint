<script>
    import Option from "./Option.svelte";
</script>

<div class='container'>
    <Option id='tds'/>
    <Option id='docv'/>
    <Option id='visual'/>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
</style>