---
name: git-history-cleanup
description: Use when a Git repository is too big or slow to clone because of large files committed in the past, and the user wants them removed from its history.
license: MIT
compatibility: Requires git and git-filter-repo. Commands are given for Bash/Zsh and Fish.
metadata:
  author: ejekanshjain
  version: "1.0.0"
---

# Git History Large-File Cleanup

Use this when large files were committed in the past, later deleted or replaced, but still make fresh clones slow.

> **Warning:** This rewrites Git history and changes commit SHAs. Every collaborator must re-clone. A mistake that gets pushed destroys history for everyone. Coordinate with collaborators before pushing.

## Rules for the Agent

Follow these for the whole procedure. They matter more than speed.

1. **One step at a time.** Run one step, show the user the full output, explain it in plain words, and ask before starting the next step. Never chain steps, even if the user says "do everything".
2. **Report every step the same way:** what ran, the result, what the expected result is and whether it matched, and what the next step does. Then ask to continue.
3. **Stop on any surprise.** If an output differs from "Expected" in this guide, or you are unsure, stop and explain. Never work around a failed check by editing lists, adding `--force`, or skipping the check.
4. **The user decides what gets deleted.** You summarize and recommend. The user reviews the list and says it is final.
5. **Two typed confirmations.** Run `git filter-repo` only after the user types `rewrite`. Push only after the user types `push`. "Yes" or "continue" is not enough for these two.
6. **Never:** pass `--force` to `git filter-repo`, use `git push --mirror`, touch the user's everyday working copy, modify `REPO-old` or `REPO-backup.git`, or delete any folder this procedure creates.
7. **Never install tools** without the user's approval.

Replace `git@github.com:ORG/REPO.git` and `REPO` in every command with the real values.

---

## 0. Prepare With the User

Ask, and wait for answers:

- The remote URL, and whether the user can force-push (protected branches need admin rights or a temporary exception).
- Who else uses the repository. **Everyone must stop pushing from step 4 until step 15 is done**, and must re-clone afterwards.
- Open pull requests: merge or close them first. Rewritten history breaks them.
- CI, deploy hooks and mirrors that react to force pushes.
- **Is this about a leaked password or key?** Then rotate it first. A rewrite does not remove copies already in forks, clones, caches or pull request refs.

Choose a new, empty work folder outside any existing repository. All steps run inside it.

**Checkpoint:** the user confirms pushes are frozen and gives the work folder.

---

## 1. Install `git-filter-repo`

Check first:

```bash
git filter-repo --version
```

If it is missing, show the user the install options for their system (package manager, `pip install git-filter-repo`, or the single script from the project's releases) and install only after they approve.

**Expected:** a version string. **Checkpoint:** continue?

---

## 2. Create an Untouched Reference Clone and a Backup

```bash
mkdir notes
git clone git@github.com:ORG/REPO.git REPO-old
git clone --mirror git@github.com:ORG/REPO.git REPO-backup.git
```

- `REPO-old` is a normal clone, used at the end to prove the current files did not change.
- `REPO-backup.git` is a complete mirror of every branch and tag: the way back if anything goes wrong (see "Recovery").

Tell the user: **never modify either of these.**

**Expected:** both folders exist without errors. **Checkpoint:** continue?

---

## 3. Create a Fresh Mirror Clone for the Cleanup

```bash
git clone --mirror git@github.com:ORG/REPO.git REPO.git
cd REPO.git
```

A mirror clone includes branches, tags and other refs without a working tree. `git filter-repo` checks that it is working on a fresh clone before rewriting. If you ever need to start over, do not reuse this folder and do not use `--force`: make a new mirror clone with a new name.

**Expected:** no errors. **Checkpoint:** continue?

---

## 4. Record the "Before" State

All remaining commands run inside `REPO.git` until step 15.

```bash
git count-objects -vH > ../notes/before-size.txt
du -sh . >> ../notes/before-size.txt
git for-each-ref --format='%(refname) %(tree)%(*tree)' refs/heads/ refs/tags/ > ../notes/before-trees.txt
git ls-remote --refs --heads --tags origin > ../notes/before-remote.txt
cat ../notes/before-size.txt
wc -l ../notes/before-trees.txt
```

- `before-size.txt`: the size now. `size-pack` is the most useful number.
- `before-trees.txt`: every branch and tag with the file tree it points at. Step 12 proves these are unchanged.
- `before-remote.txt`: what the remote holds now. Step 14 proves nobody pushed in between.

**Expected:** a size, and a line count equal to the number of branches plus tags. **Checkpoint:** show the size and ask to continue. From now on, nobody may push.

---

## 5. Find Every Historical Blob Larger Than the Threshold

Ask the user for a threshold. 16 KB (16384 bytes) also catches old versions of large source files; 1 MB (1048576) catches only big files. Scanning changes nothing, so run both if the user is unsure.

Works in Bash, Zsh and Fish:

```bash
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '$1 == "blob" && $3 > 16384 { print $2 "\t" $3 "\t" substr($0, length($1 $2 $3) + 4) }' \
  | sort -k2,2nr \
  > ../notes/all-large-blobs.txt
wc -l ../notes/all-large-blobs.txt
```

Format: `BLOB_SHA<TAB>SIZE_BYTES<TAB>PATH`, largest first. The `substr` keeps paths with spaces whole (`$4` would cut `launch trailer.mp4` down to `launch`). The path is where each blob was first seen.

**Expected:** a count of rows. **Checkpoint:** continue?

---

## 6. List Blobs Still Used by Any Branch or Tag Tip

These are protected: they are never removed, so every branch and tag, including release tags, keeps its current files.

Works in Bash, Zsh and Fish:

```bash
git for-each-ref --format='%(refname)' refs/heads/ refs/tags/ \
  | xargs -n1 git ls-tree -r \
  | awk '$2 == "blob" {print $3}' \
  | sort -u \
  > ../notes/current-blobs.txt
wc -l ../notes/current-blobs.txt
```

**Expected:** a count of rows and no errors. An error from a tag that points directly at a file (rare) means stop and inspect that tag. **Checkpoint:** continue?

---

## 7. Keep Only Historical Blobs That Are Not Live

Works in Bash, Zsh and Fish:

```bash
awk 'NR==FNR {live[$1]=1; next} !live[$1]' \
  ../notes/current-blobs.txt \
  ../notes/all-large-blobs.txt \
  > ../notes/historical-large-blobs.txt
wc -l ../notes/historical-large-blobs.txt
```

Summarize the candidates for the user, by file type and as the 30 largest:

```bash
awk -F'\t' '{ n = split($3, p, "/"); f = p[n]; e = match(f, /\.[^.]+$/) ? tolower(substr(f, RSTART)) : "(none)"; c[e]++; b[e] += $2 } END { for (e in c) printf "%-12s %6d files %10.2f MB\n", e, c[e], b[e] / 1048576 }' ../notes/historical-large-blobs.txt | sort -k4,4nr
head -30 ../notes/historical-large-blobs.txt | awk -F'\t' '{ printf "%10.2f MB  %s\n", $2 / 1048576, $3 }'
```

Also tell the user which large files are **not** candidates because a branch or tag still contains them (the difference between steps 5 and 7). A release tag on an old commit protects every file in that commit. Removing those means deleting or moving the tag, a separate decision to make with the owner before scanning again.

**Checkpoint:** show both summaries and continue to the review.

---

## 8. The User Reviews the List

**This is the most important step. Do not rush it and do not decide for the user.**

Give the user the path to `notes/historical-large-blobs.txt` and explain:

- **Every row left in this file will be deleted from all history.** Old commits that contained those files will no longer have them.
- Commonly removed: old `.mp4` and other videos, `.png`, `.jpg`, `.jpeg` and other images, archives, generated binaries, build outputs, dumps and logs, deleted large files, and oversized old versions of files that were later replaced.
- Commonly kept: source-code history you care about, old configuration files, intentionally versioned assets.

Recommend, with reasons, which groups look safe to remove. Filter the file for the user only when they ask for a specific rule (for example "only `.mp4` and `.zip`"), then show the result.

Ask the user to open the file, **delete every row they want to keep**, save it, and tell you the list is final.

**Checkpoint:** the user explicitly says the list is final. Then show the row count and the largest rows again from the saved file.

---

## 9. Extract the Exact Blob IDs to Remove

```bash
awk -F'\t' '{print $1}' ../notes/historical-large-blobs.txt > ../notes/blob-ids-to-remove.txt
wc -l ../notes/blob-ids-to-remove.txt
git cat-file --batch-check='%(objecttype)' < ../notes/blob-ids-to-remove.txt | sort | uniq -c
```

**Expected:** the same count as the reviewed file, and the second command prints only one line, `N blob`. Anything else (`missing`, `commit`, `tree`) means the file was edited incorrectly: stop and go back to step 8.

**Checkpoint:** continue?

---

## 10. Safety Check: No Selected Blob Is Currently Live

### Bash / Zsh

```bash
comm -12 \
  <(sort ../notes/current-blobs.txt) \
  <(sort ../notes/blob-ids-to-remove.txt)
```

### Fish

```fish
sort ../notes/current-blobs.txt > ../notes/current-blobs-sorted.txt
sort ../notes/blob-ids-to-remove.txt > ../notes/remove-blobs-sorted.txt
comm -12 ../notes/current-blobs-sorted.txt ../notes/remove-blobs-sorted.txt
```

**Expected output: nothing.** If anything prints, stop: those files are in use today. Go back to step 8.

**Checkpoint:** continue?

---

## 11. Calculate How Much Data Will Be Removed

```bash
git cat-file --batch-check='%(objectsize)' < ../notes/blob-ids-to-remove.txt \
  | awk '{ total += $1 } END {
      printf "Total bytes: %d\n", total
      printf "Total MB: %.2f MB\n", total / 1024 / 1024
      printf "Total GB: %.3f GB\n", total / 1024 / 1024 / 1024
    }'
```

This is the uncompressed size. The clone shrinks less, because Git compresses and delta-packs objects.

**Tell the user exactly:** "This removes N files, X MB uncompressed, from the history of `git@github.com:ORG/REPO.git`. Every branch and tag keeps its current files. Nothing leaves this machine until the push step."

**Checkpoint: ask the user to type `rewrite` to proceed.**

---

## 12. Remove the Selected Blobs, Then Verify

Only after the user typed `rewrite`:

```bash
git filter-repo --strip-blobs-with-ids ../notes/blob-ids-to-remove.txt
```

**Expected:** "Parsed N commits", "New history written", "Completely finished". `git filter-repo` already expires reflogs and repacks. An extra `git gc --prune=now --aggressive` is optional, slow on big repositories, and usually unnecessary.

If it refuses because the repository is not a fresh clone: **do not use `--force`**. Go back to step 3 with a new mirror clone under a new name.

Now verify, and show all three results:

**Size**, compared with `before-size.txt`:

```bash
git count-objects -vH
du -sh .
```

**Every branch and tag still has exactly the same files:**

```bash
git for-each-ref --format='%(refname) %(tree)%(*tree)' refs/heads/ refs/tags/ > ../notes/after-trees.txt
diff ../notes/before-trees.txt ../notes/after-trees.txt
```

**Expected output: nothing.** This covers every branch and tag, not only the default branch: identical tree IDs mean identical files, paths and modes.

**The removed blobs are gone:**

Bash / Zsh:

```bash
while read sha; do
  git cat-file -e "$sha" 2>/dev/null && echo "STILL EXISTS: $sha"
done < ../notes/blob-ids-to-remove.txt
```

Fish:

```fish
while read -l sha
    if git cat-file -e "$sha" 2>/dev/null
        echo "STILL EXISTS: $sha"
    end
end < ../notes/blob-ids-to-remove.txt
```

**Expected output: nothing.**

If any of the three is wrong: **do not push.** Explain, and start again from step 3. **Checkpoint:** continue?

---

## 13. Check the Remote

`git filter-repo` removes `origin` to prevent accidental pushes.

```bash
git remote -v
```

If `origin` is missing:

```bash
git remote add origin git@github.com:ORG/REPO.git
```

**Expected:** `origin` points at exactly the URL from step 2. **Checkpoint:** continue?

---

## 14. Confirm Nobody Pushed, Then Push

First, prove the remote has not changed since step 4. Pushing over someone's new work would erase it.

```bash
git ls-remote --refs --heads --tags origin > ../notes/now-remote.txt
diff ../notes/before-remote.txt ../notes/now-remote.txt
```

**Expected output: nothing.** If anything prints, stop: someone pushed. Do not push. Unfreeze nothing, and start again from step 3 once pushes are frozen.

Remind the user that GitHub may keep old history reachable through pull request refs and caches until it cleans up. See "What the Host Keeps".

**Checkpoint: ask the user to type `push` to proceed.**

Only after the user typed `push`, push branches and tags explicitly:

```bash
git push --force origin 'refs/heads/*:refs/heads/*'
git push --force origin 'refs/tags/*:refs/tags/*'
```

**Expected:** `(forced update)` for rewritten refs. If Git says `--mirror can't be combined with refspecs`, the remote still has its mirror setting: push to the URL instead, `git push --force git@github.com:ORG/REPO.git 'refs/heads/*:refs/heads/*'`, and the same for tags. Do not use `git push --mirror`.

Then confirm the remote now matches the cleaned mirror:

```bash
git ls-remote --refs --heads --tags origin | awk '{print $1, $2}' | sort -k2 > ../notes/remote-after.txt
git for-each-ref --format='%(objectname) %(refname)' refs/heads/ refs/tags/ | sort -k2 > ../notes/local-after.txt
diff ../notes/local-after.txt ../notes/remote-after.txt
```

**Expected output: nothing.** **Checkpoint:** continue?

---

## 15. Clone the Cleaned Repository Fresh

```bash
cd ..
git clone git@github.com:ORG/REPO.git REPO-clean
du -sh REPO-clean/.git
```

Compare with `notes/before-size.txt`. On GitHub the fresh clone may not shrink right away; see "What the Host Keeps".

**Checkpoint:** continue?

---

## 16. Verify the Cleaned Clone Matches the Untouched Old Clone

Use `sha256sum`; on macOS without it, use `shasum -a 256` in its place.

```bash
cd REPO-old
find . -type f -not -path './.git/*' -print0 | sort -z | xargs -0 sha256sum > ../notes/old-hashes.txt
cd ../REPO-clean
find . -type f -not -path './.git/*' -print0 | sort -z | xargs -0 sha256sum > ../notes/new-hashes.txt
cd ..
diff -u notes/old-hashes.txt notes/new-hashes.txt
```

**Expected output: nothing:** same file paths, same number of files, same contents on the default branch. Step 12 already proved every other branch and tag.

Optional file-count check:

```bash
find REPO-old -type f -not -path '*/.git/*' | wc -l
find REPO-clean -type f -not -path '*/.git/*' | wc -l
```

**Expected:** the counts match. **Checkpoint:** continue?

---

## 17. Hand Over

- Give the user a message for collaborators: history was rewritten on DATE; delete old clones and clone fresh with `git clone git@github.com:ORG/REPO.git`; never push from an old clone or merge old history back.
- Tell the user to lift the push freeze and re-enable anything they disabled.
- **Keep `REPO-backup.git` and `notes/`** until everyone confirms the new repository works, ideally for a few weeks. Deleting them is the user's decision.
- Report: size before and after, files removed, and anything you could not verify.

---

## What the Host Keeps

Force-pushing replaces branches and tags, but some copies survive:

- **Pull request refs** (`refs/pull/*` on GitHub) are read-only and keep old history reachable until the host cleans up. That is also why pushes may reject such refs.
- **Forks** keep their own copy of the old history.
- **Unreachable objects and cached views** stay on the server until the host runs garbage collection, so a fresh clone may not shrink immediately. GitHub Support can run a cleanup on request.
- **Existing clones, CI caches and mirrors** keep old history until deleted.

For leaked secrets this means a rewrite is never enough on its own: rotate the secret.

---

## Recovery

**Before the push:** nothing has left the machine. Leave the broken mirror as it is, make a new mirror clone with a new name, and restart from step 3.

**After the push, if something is wrong:** restore every branch and tag from the untouched backup. Push to the URL, because a mirror clone's `origin` refuses pushes of specific refs:

```bash
git -C REPO-backup.git push --force git@github.com:ORG/REPO.git 'refs/heads/*:refs/heads/*'
git -C REPO-backup.git push --force git@github.com:ORG/REPO.git 'refs/tags/*:refs/tags/*'
```

Then check the remote matches the backup (the same `ls-remote` and `for-each-ref` comparison as in step 14, run against `REPO-backup.git`), tell collaborators to keep their old clones for now, and investigate before trying again.

---

## Preventing It Next Time

- Keep large media and binaries in Git LFS or object storage.
- Ignore build outputs, recordings, dumps and archives in `.gitignore`.
- Add a pre-commit or CI check that rejects files over a size limit.
