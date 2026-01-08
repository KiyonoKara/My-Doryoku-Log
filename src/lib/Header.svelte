<script>
	export let label;
</script>

<style>
	.header {
			display: flex;
			align-items: center;
			overflow: hidden;
      background-color: #e1e2e6;
      padding: 16px;
	}

  .header h1 {
      float: left;
      color: #1c2127;
      text-align: center;
      padding: 6px;
      text-decoration: none;
      font-size: 28px;
      line-height: 25px;
      border-radius: 4px;
  }

	.header h1.logo {
      font-weight: bold;
      display: flex;
      align-items: center;
  }

  .header-logo img {
      width: 40px;
      height: 40px;
			display: block;
  }
</style>

<div class="header">
	<h1 class="logo">{label}</h1>
	<div class="header-logo" aria-hidden="true">
		<img src="/src/lib/assets/notebook.svg" alt="" />
	</div>
</div>