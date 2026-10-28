from k_minigames import catalog, model_check


def test_catalog_has_an_advisor_and_coders_sorted_by_size():
    assert catalog.advisor().id == "qwen2.5:3b"
    sizes = [m.size_gb for m in catalog.coders()]
    assert sizes == sorted(sizes) and len(sizes) >= 3
    assert "qwen2.5-coder:7b" in [m.id for m in catalog.coders()]


def test_a_fitting_proposal_is_used_as_it_is():
    rec = model_check.recommend("qwen2.5-coder:7b", ram_gb=16, vram_gb=None)
    assert rec.model.id == "qwen2.5-coder:7b" and rec.substituted is False and rec.fits is True


def test_a_proposal_too_big_for_the_machine_is_replaced_by_the_biggest_that_fits():
    rec = model_check.recommend("qwen2.5-coder:32b", ram_gb=24, vram_gb=None)
    assert rec.model.id == "qwen2.5-coder:14b" and rec.substituted is True and rec.fits is True
    assert "sığmıyor" in rec.reason


def test_an_unknown_model_name_is_replaced_and_the_reason_says_so():
    rec = model_check.recommend("uydurma-model:9b", ram_gb=16, vram_gb=None)
    assert rec.model.id == "qwen2.5-coder:7b" and rec.substituted is True
    assert "katalogda yok" in rec.reason


def test_no_proposal_on_a_weak_machine_gives_the_smallest_model_flagged_as_not_fitting():
    rec = model_check.recommend(None, ram_gb=3, vram_gb=None)
    assert rec.model == catalog.coders()[0] and rec.fits is False and rec.substituted is True


def test_case_and_whitespace_in_the_proposal_are_ignored():
    rec = model_check.recommend("  Qwen2.5-Coder:7B ", ram_gb=16, vram_gb=None)
    assert rec.model.id == "qwen2.5-coder:7b" and rec.substituted is False


def test_a_big_graphics_card_lets_a_model_fit_even_with_little_ram():
    rec = model_check.recommend("qwen2.5-coder:7b", ram_gb=4, vram_gb=12)
    assert rec.model.id == "qwen2.5-coder:7b" and rec.substituted is False and rec.fits is True
