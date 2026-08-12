import sys
sys.path.insert(0, '.')
import asyncio
import json
import math

from app.core.ai_providers import MockProvider
from app.services.ai_generator_service import QuestionBlueprint, DeterministicValidator


async def test(question_count):
    oversample = question_count + max(4, math.ceil(0.3 * question_count))
    print(f"\n===== Testing question_count={question_count}, oversample={oversample} =====")

    blueprint = QuestionBlueprint.create_blueprint(
        question_count=oversample,
        difficulty='medium',
        bloom_levels=['Understand', 'Apply'],
        question_types=['multiple_choice'],
        topic='Python',
        question_distribution=None
    )

    prompt = f'Generate exactly {oversample} questions based on this exact blueprint:\n'
    for slot in blueprint:
        prompt += f"- Slot {slot.order_index}: Difficulty={slot.difficulty}, Bloom Level={slot.bloom_level}, Type={slot.question_type}, Target Objective='{slot.learning_objective}'\n"

    provider = MockProvider()
    result = await provider.generate_questions(prompt, '', 'mock')
    print(f'Mock generated: {len(result.questions)} questions')

    # Run critic
    critic_prompt = f'Please audit the following {len(result.questions)} questions:\n' + json.dumps(
        [{'index': i, 'topic': 'Python', 'learning_objective': q.get('learning_objective', '')} 
         for i, q in enumerate(result.questions)], indent=2
    )
    critic_result = await provider.generate_questions(
        critic_prompt, 'You are acting as a Senior Academic Auditor', 'mock'
    )
    print(f'Critic evaluated: {len(critic_result.questions)} evals')
    failed = [e['index'] for e in critic_result.questions if not e.get('is_valid', True)]
    print(f'Failed critic at indexes: {failed}')

    # Quality filter
    candidates = []
    for i, q in enumerate(result.questions):
        if i < len(critic_result.questions):
            ev = critic_result.questions[i]
            score = (ev.get('educational_quality', 4) + ev.get('originality', 4) + ev.get('reasoning_depth', 4) + ev.get('clarity', 4) + ev.get('engagement', 4)) / 5.0
            if score >= 3.0:
                candidates.append(q)
    print(f'Candidates after quality filter: {len(candidates)}')

    # Diversity audit
    SIM_THRESHOLD_STEM = 0.35
    SIM_THRESHOLD_OBJ = 0.40
    selected = []
    rejected_reasons = []

    for q in candidates:
        if len(selected) >= question_count:
            break
        too_similar = False
        reason = None
        for sq in selected:
            sim_stem = DeterministicValidator.calculate_jaccard(q.get('text', ''), sq.get('text', ''))
            sim_obj = DeterministicValidator.calculate_jaccard(q.get('learning_objective', ''), sq.get('learning_objective', ''))
            q_opts = [o.get('text', '').lower().strip() for o in q.get('options', [])]
            sq_opts = [o.get('text', '').lower().strip() for o in sq.get('options', [])]
            common_opts = set(q_opts) & set(sq_opts)
            if sim_stem > SIM_THRESHOLD_STEM or sim_obj > SIM_THRESHOLD_OBJ or len(common_opts) > 1:
                too_similar = True
                reason = f"sim_stem={sim_stem:.2f}, sim_obj={sim_obj:.2f}, common_opts={len(common_opts)}"
                break
        if not too_similar:
            selected.append(q)
        else:
            rejected_reasons.append(reason)

    print(f'After diversity audit: {len(selected)} selected, {len(rejected_reasons)} rejected')
    for r in rejected_reasons[:10]:
        print(f'  Rejected because: {r}')
    print(f'RESULT: {len(selected)} / {question_count} questions returned')
    return len(selected)


async def main():
    for count in [5, 10, 20, 30]:
        result = await test(count)
        print(f">>> FINAL: requested={count}, got={result}")


asyncio.run(main())
