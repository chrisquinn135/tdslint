<script>
    import OptionList from "../components/Option/OptionList.svelte";
</script>

<div class='container'>
    <div class='desc'>
        <div class='text-lg-med'>
            Choose what type of configuration you want to use when linting your document:
        </div>
    </div>
    <div>
        <OptionList />
    </div>
</div>

<style>
    .container {
        padding:16px;
        display:flex;
        flex-direction: column;
        gap:16px;
    }
    .desc {
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
</style>