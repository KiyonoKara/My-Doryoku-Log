<script lang="ts">
	import github from '$lib/assets/github.svg';
</script>

<footer class="footer">
	<div class="footer__right">
		<a
			href="https://github.com/KiyonoKara/My-Doryoku-Log"
			target="_blank"
			rel="noopener noreferrer"
			class="footer__github"
			aria-label="View source on GitHub"
		>
			<img src={github} alt="" aria-hidden="true" class="footer__icon" />
		</a>
		<span class="footer__text">Made by KiyonoKara</span>
	</div>
</footer>

<style>
	.footer {
		width: 100%;
		margin-top: auto;
		padding: 0.85rem 1.5rem;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		background: transparent;
		border-top: 1px solid var(--border-subtle);
	}

	.footer__right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		line-height: 1;
	}

	.footer__github {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition:
			background var(--transition-base),
			opacity var(--transition-base);
	}

	.footer__github:hover {
		background: var(--bg-deep);
	}

	.footer__icon {
		width: 15px;
		height: 15px;
		display: block;
		opacity: 0.6;
		filter: var(--icon-filter);
		transition: opacity var(--transition-base);
	}

	.footer__github:hover .footer__icon {
		opacity: 0.9;
	}

	.footer__text {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		letter-spacing: 0.02em;
		line-height: 1;
		user-select: none;
	}
</style>
