from math import sqrt
from random import randrange
from datetime import datetime
from random import shuffle, seed

# code and implementation based on: https://machinelearningmastery.com/implement-random-forest-scratch-python/

# coarse mappings and constants
COARSE_EXPENSE_MAP = {
    'Groceries': 'Living',
    'Rent': 'Living',
    'Dining': 'Leisure',
    'Entertainment': 'Leisure',
    'Travel': 'Leisure',
    'Merchandise': 'Shopping',
    'Other': 'Other',
    'Other Services': 'Other',
}

COARSE_INCOME_MAP = {
    'Salary': 'Regular Income',
    'Allowance': 'Regular Income',
    'Stocks': 'Investments',
    'Interest & Dividends': 'Investments',
    'Reimbursements': 'Other Income',
    'Gifts': 'Other Income',
    'Sales': 'Other Income',
}

COARSE_CATEGORIES = sorted(set(COARSE_EXPENSE_MAP.values()) | set(COARSE_INCOME_MAP.values()))
ALL_CATEGORIES = list(COARSE_EXPENSE_MAP.keys() | COARSE_INCOME_MAP.keys())
COARSE_TO_ID = {category: i for i, category in enumerate(COARSE_CATEGORIES)}
ID_TO_COARSE = {i: category for category, i in COARSE_TO_ID.items()}
CATEGORY_TO_ID = {category: i for i, category in enumerate(ALL_CATEGORIES)}

# split the dataset by a possible split point
def test_split(index, value, dataset):
    left, right = list(), list()
    for row in dataset:
        if row[index] < value:
            left.append(row)
        else:
            right.append(row)
    return left, right

# find purity of class values being separated
def gini_index(groups, classes):
    # count all samples at split point
    n_instances = float(sum([len(group) for group in groups]))
    # sum weighted Gini index for each group
    gini = 0.0
    for group in groups:
        size = float(len(group))
        # prevent zero division
        if size == 0:
            continue
        score = 0.0
        # score the group based on score for each class
        for class_val in classes:
            p = [row[-1] for row in group].count(class_val) / size
            score += p * p
        # weigh the group score by the relative size
        gini += (1.0 - score) * (size / n_instances)
    return gini

# find the best split point for a dataset
def get_split(dataset, n_features):
    class_values = list(set(row[-1] for row in dataset))
    b_index, b_value, b_score, b_groups = 999, 999, 999, None
    features = list()
    while len(features) < n_features:
        index = randrange(len(dataset[0])-1)
        if index not in features:
            features.append(index)
    for index in features:
        for row in dataset:
            groups = test_split(index, row[index], dataset)
            gini = gini_index(groups, class_values)
            if gini < b_score:
                b_index, b_value, b_score, b_groups = index, row[index], gini, groups
    return {'index': b_index, 'value': b_value, 'groups': b_groups}

# create a terminal node value
def to_terminal(group):
    outcomes = [row[-1] for row in group]
    return max(set(outcomes), key=outcomes.count)

# create sub splits for a node or make terminal
def split(node, max_depth, min_size, n_features, depth):
    left, right = node['groups']
    del(node['groups'])

    # check for no split
    if not left or not right:
        node['left'] = node['right'] = to_terminal(left + right)
        return
    # check for max depth
    if depth >= max_depth:
        node['left'], node['right'] = to_terminal(left), to_terminal(right)
        return
    # process left sub
    if len(left) <= min_size:
        node['left'] = to_terminal(left)
    else:
        node['left'] = get_split(left, n_features)
        split(node['left'], max_depth, min_size, n_features, depth+1)
    # process right sub
    if len(right) <= min_size:
        node['right'] = to_terminal(right)
    else:
        node['right'] = get_split(right, n_features)
        split(node['right'], max_depth, min_size, n_features, depth+1)

# build decision tree
def build_tree(train, max_depth, min_size, n_features):
    root = get_split(train, n_features)
    split(root, max_depth, min_size, n_features, 1)
    return root

# predict with decision tree
def tree_predict(node, row):
    if row[node['index']] < node['value']:
        if isinstance(node['left'], dict):
            return tree_predict(node['left'], row)
        else:
            return node['left']
    else:
        if isinstance(node['right'], dict):
            return tree_predict(node['right'], row)
        else:
            return node['right']

# create a random subsample from the dataset with replacement
def subsample(dataset, ratio):
    sample = list()
    n_sample = round(len(dataset) * ratio)
    while len(sample) < n_sample:
        index = randrange(len(dataset))
        sample.append(dataset[index])
    return sample

# make a prediction with a list of bagged trees
def bagging_predict(trees, row):
    predictions = [tree_predict(tree, row) for tree in trees]
    return max(set(predictions), key=predictions.count)

# train test split
def train_test_split(X, y, test_ratio=0.2, random_state=0):
    # set random state
    seed(random_state)

    indices = list(range(len(X)))
    shuffle(indices)
    test_size = int(len(X) * test_ratio)
    test_idx = indices[:test_size]
    train_idx = indices[test_size:]

    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_test = [X[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    return X_train, X_test, y_train, y_test

def accuracy(y_true, y_pred):
    correct = sum(1 for a, b in zip(y_true, y_pred) if a == b)
    return correct / len(y_true) if y_true else 0.0

# specifically for the transaction data
def build_datasets(rows: list[dict]) -> tuple:
    # expense
    X_exp_clf, y_exp_clf = [], []
    X_exp_reg, y_exp_reg = [], []

    # income
    X_inc_clf, y_inc_clf = [], []
    X_inc_reg, y_inc_reg = [], []

    for tr in rows:
        date_str = tr['date']
        amount = float(tr['amount'])
        category = tr['category']
        trtype = tr['type']

        if category not in ALL_CATEGORIES:
            continue

        # get date features
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        dow = dt.weekday()
        dom = dt.day
        month = dt.month
        is_weekend = int(dow >= 5)
        is_month_start = int(dom <= 3)
        is_month_end = int(dom >= 28)

        # coarse labelling
        coarse_cat = COARSE_EXPENSE_MAP.get(category, 'Other') if trtype == 'expense' else COARSE_INCOME_MAP.get(category, 'Other Income')
        coarse_id = COARSE_TO_ID[coarse_cat]

        # fine id
        fine_id = CATEGORY_TO_ID[category]

        if trtype == 'expense':
            # expense
            # for classifier
            X_exp_clf.append([dow, month, amount, is_weekend, is_month_start, is_month_end])
            y_exp_clf.append(coarse_id)
            # for regression
            X_exp_reg.append([dow, month, is_weekend, is_month_start, fine_id])
            y_exp_reg.append(amount)
        else:
            # income
            # for classifier
            X_inc_clf.append([dow, month, amount, is_weekend, is_month_start, is_month_end])
            y_inc_clf.append(coarse_id)
            # for regression
            X_inc_reg.append([dow, month, is_weekend, is_month_start, fine_id])
            y_inc_reg.append(amount)

    return (X_exp_clf, y_exp_clf, X_exp_reg, y_exp_reg,
            X_inc_clf, y_inc_clf, X_inc_reg, y_inc_reg)


